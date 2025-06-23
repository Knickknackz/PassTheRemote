import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, isAuthorized } from '../_shared/utils.ts';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY'); // ⬅️ Set this in Supabase project settings
const REACTR_EXTENSION_SECRET = Deno.env.get('REACTR_EXTENSION_SECRET');

function normalizeStreamingOptions(streamingOptions: Record<string, any>) {
  const platformStreams: Record<string, any> = {};
  const availabilityByPlatform: Record<string, string[]> = {};

  for (const [countryCode, entries] of Object.entries(streamingOptions)) {
    for (const entry of entries as any[]) {
      const type = entry.type;
      if (!['subscription', 'addon'].includes(type)) continue;

      let platformId: string | undefined;
      if (type === 'addon' && entry.addon?.id) {
        platformId = entry.addon.id.toLowerCase();
      } else if (entry.service?.id) {
        platformId = entry.service.id.toLowerCase();
      }
      if (!platformId) continue;

      if (!availabilityByPlatform[platformId]) availabilityByPlatform[platformId] = [];
      if (!availabilityByPlatform[platformId].includes(countryCode)) {
        availabilityByPlatform[platformId].push(countryCode);
      }

      if (!platformStreams[platformId]) {
        platformStreams[platformId] = {
          link: entry.link,
          videoLink: entry.videoLink || null,
          quality: entry.quality || null,
          expiresSoon: !!entry.expiresSoon,
          ...(entry.expiresSoon && entry.expiresOn ? { expiresOn: entry.expiresOn } : {}),
        };
      }
    }
  }

  return { availabilityByPlatform, platformStreams };
}

function extractExpires(url: string): number | null {
  const match = url.match(/Expires=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function findEarliestExpiration(imageSet: any): number | null {
  const urls = [
    ...Object.values(imageSet?.verticalPoster || {}),
    ...Object.values(imageSet?.horizontalPoster || {}),
    ...Object.values(imageSet?.horizontalBackdrop || {})
  ].filter(Boolean);

  const expires = urls.map(extractExpires).filter((e) => typeof e === 'number');
  return expires.length > 0 ? Math.min(...expires) : null;
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  if (!isAuthorized(req, REACTR_EXTENSION_SECRET)) {
    console.error('❌ Unauthorized request');
    return jsonResponse('Unauthorized', 401);
  }

  const { title } = await req.json();
  if (!title) return jsonResponse('Missing title', 400);
  console.log(title);
  try {
    const apiRes = await fetch(`https://streaming-availability.p.rapidapi.com/shows/search/title?title=${encodeURIComponent(title)}&country=us`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'streaming-availability.p.rapidapi.com',
      },
    });

    const data = await apiRes.json();
    const result = data?.[0];

    if (!result) {return jsonResponse({ found: false }, 200);}
    console.log(result);
    const expiresAt = findEarliestExpiration(result.imageSet);
    const expires_at = expiresAt ? new Date(expiresAt * 1000).toISOString() : null;
    const { availabilityByPlatform, platformStreams } = normalizeStreamingOptions(result.streamingOptions);
    const meta = {
        found: true,
        title: result.title,
        overview: result.overview,
        year: result.firstAirYear,
        genres: result.genres?.map((g: any) => g.name),
        posters: {
            vertical: result.imageSet?.verticalPoster || {},
            horizontal: result.imageSet?.horizontalPoster || {},
            backdrop: result.imageSet?.horizontalBackdrop || {},
        },
        expires_at,
        availability_by_platform: availabilityByPlatform,
        platform_streams: platformStreams,
    };
    console.log(meta);
    return jsonResponse(meta, 200);
  } catch (err) {
    console.error('❌ Metadata fetch failed:', err);
    return jsonResponse('Error fetching metadata', 500);
  }
});
//Example Response
/*[
  {
    itemType: "show",
    showType: "series",
    id: "5059481",
    imdbId: "tt22248376",
    tmdbId: "tv/209867",
    title: "Frieren: Beyond Journey's End",
    overview: "After the party of heroes defeated the Demon King, they restored peace to the land and returned to lives of solitude. Generations pass, and the elven mage Frieren comes face to face with humanity’s mortality. She takes on a new apprentice and promises to fulfill old friends’ dying wishes. Can an elven mind make peace with the nature of life and death? Frieren embarks on her quest to find out.",
    firstAirYear: 2023,
    lastAirYear: 2024,
    originalTitle: "葬送のフリーレン",
    genres: [
      { id: "adventure", name: "Adventure" },
      { id: "animation", name: "Animation" }
    ],
    creators: [],
    cast: [
      "Atsumi Tanezaki",
      "Kana Ichinose",
      "Chiaki Kobayashi",
      "Nobuhiko Okamoto",
      "Hiroki Touchi",
      "Yoji Ueda",
      "Kento Shiraishi"
    ],
    rating: 85,
    seasonCount: 2,
    episodeCount: 28,
    imageSet: {
      verticalPoster: {
        w240: "https://cdn.movieofthenight.com/show/5059481/poster/vertical/en/240.jpg?Expires=1777858167&Signature=O-yxVm5UwxnluHHXVd8Ya4QvlZAz8i-knVSTSuEofPNOBZGz5M0eEeG4ST~UPf3pPoKy9eyKf2qEXDIpby027Q6ehxlesm1dY5qGpkz4xk3Lm8wOrjkEkdPDQG8eIMMtblYygFmmuDHnnx2MbcAzQNFoTETapZ1tKRuhALEi05nvPSWpjRWG~UeD4cLFrnQ6dQvvLClNBBlVwg5IyYsyG6BBnbsW9UzHzmb-TvvaIYGODGpmJsoSfdL0HmtZpxIVcAJ0GF3G1V5EiRkNSfCI-kkPjHJbYbZFSNM7i08KiH5UMk4C~k2xs7qs~TSQGZm2nkexNqvzg2HU9rg1zjr8Bw__&Key-Pair-Id=KK4HN3OO4AT5R",
        w360: "https://cdn.movieofthenight.com/show/5059481/poster/vertical/en/360.jpg?Expires=1777858167&Signature=XV6ekOstkIIllOivcTtdkzrNIDxkAt500fyUP20PXB6k3D0vHhGT5b4ESy4Zq8DJf2p5jskWZZSfIwaXK1opAmlxfsyAE-uE0KbQZK-xtW4xUVc88yjlHsdRzK6OB2bUoZXwT~nmFLlCZ~1f5i7pm5y4Nn5LNExE8zcxzCW0ygJePpM9hafjuJfhDiEGKUcSfhVwW9Fu9Sdan2-kTTmEy4SybRhv6IEKNlVBolwsVHAxLkHjySJy1cT4qNqW3jHS4UipuxUzxXEAIdfDzCG2-3p87M-4dVLYkjmVAvftjS0~a76kSKZJluLp82OjZGncO0ZNtrnsa2OSYNF6A2QbUQ__&Key-Pair-Id=KK4HN3OO4AT5R",
        w480: "https://cdn.movieofthenight.com/show/5059481/poster/vertical/en/480.jpg?Expires=1777858167&Signature=U6LqB5Uzo214imGvTOw527HtE7yANPhQ~hLP4dS0quZt4EFcQuH1nLeMDWhT1KVVwCC1e7eL0dGBylTtDDKSHxLE5YdChGGs23KoMMmktvn14LVwYn16s0G-6aqAu2MQiS4AZFT1up6qTcMhwr4D60qc1YQbRNfoZC6Sdo8RryA0gG-jmSugniKJBKWsCSIPJ~-GIs12JU3BzC2awypjTMGMEP7aFbjb4wa8Ir56Zs2Jd~Nj1TtnPE3OLOpAvnWburADRBjBbSas58YCuvsSSzE0wBFNjXXmTYkop51Pd5Dveipu1OwuLsna0XpnGSWnkZIISU3g86Ce76H1Yhj8Jw__&Key-Pair-Id=KK4HN3OO4AT5R",
        w600: "https://cdn.movieofthenight.com/show/5059481/poster/vertical/en/600.jpg?Expires=1777858167&Signature=jUWrmKK1jZvkiUpCDoElkWESxdAa7AG-xp96rNsYA-S4XFesg5nX5fqAxq74d0VXKJn8w4qACb3kaU9z65W31LJfjlR~bMVJHScjpE8vxZaXfKuDptdblElwewTkdSyUtzQb6AnVbzxAnpnsKdzpRo25TdWbt1cCQ8QpxfuQ7WkKs8NjugtvctYbiMNrohM581Gs4GjyPDYZB0t1I5yRdOUY2mHQdOLX9GKcpYHOfzzf91JLfF6U1j-ZVyTIUDTUI249TweNS7yA573sr1FSxvXXYfL6QHeM3UmpW16xR1oIuZXkx3rXjyhNj-BNHn5BDBrj~dFsheVSZnW-co1RzA__&Key-Pair-Id=KK4HN3OO4AT5R",
        w720: "https://cdn.movieofthenight.com/show/5059481/poster/vertical/en/720.jpg?Expires=1777858167&Signature=I53NyLFzwieiyEbOUclZgJG8yxZyHzH-WKR2mTYJBNdChhHOKQhjByGMcnzfkvRZextc6Cu0nmoVno7Q0Nu8nvD9tilLLu9lklZd0KJxQ7G5s8L-f1CDyZeCgOE5WM-4KlvhK1ekPfv2A48QCkgX39HgS3ehVqCETr1MpHkG-90j0dkEsdWuyz8LPUGJ85TsY8W-3Cs8~OsrH91Y8NqzxKVpRp6NrCQCM5G4XmMiQRIRP0sR77IbnQwHXVbpnAfuyfyuEWhvHQ72~Wkxmj33O7EXA-32r1gaWrwbGBd9uPB9BKJEKtWz7af7VAuuI2LB6Bm2Kt3FndiQOPwJCXUUxw__&Key-Pair-Id=KK4HN3OO4AT5R"
      },
      horizontalPoster: {
        w360: "https://cdn.movieofthenight.com/show/5059481/poster/horizontal/en/360.jpg?Expires=1769117297&Signature=eomp~~UF4mkeGsXpY~V8HCzha1NgHypNy82CRnWgK6UNPT49kn99G6wdLmE~A8M51dZlHN24GXsWtgBZ~PwzPRTtj06X3nDyu3lsLlO4zXBWyH5RKgM9FhOi3gXgkDvuDWa8BnZeW1MheseIFwwTlCcLh~TZKfqRoHjbnuCSv-e~SVMAlnKDJ3QRVg1Dx-UoToXwoBdWmcwAXaYETM5JPQFqJ80ceIO9emhSStRIxPxGR3ynS2jE3-KYXRijID43ZZPRuo7bFDVAo1pGDwE9y5uG1n7wNYO0MVJ5XqUR-HQ2SVN82HrtDP-9Yph-36GsYeGri0UM7vrNkCQauFP2wQ__&Key-Pair-Id=KK4HN3OO4AT5R",
        w480: "https://cdn.movieofthenight.com/show/5059481/poster/horizontal/en/480.jpg?Expires=1769117297&Signature=a2bF-E6LhW8BcEEeJmcTFwFhEYRUkZyMQsd9CXnkLLpNrZ8-OdVUon-gvD6oUiiTJ1JU0MzXSyL1qyvcd7JSuiYSBq8EIaVeN3I15LdvkIMbNgV-gCrHc6OP~u22NjeqfvtsyHfavH9vPMG6vK2W0dhESaWYQuWGzj2khGTGWTn9aGa1wwNY2tq9OzZfl0zp~QpPFs9pef79Cd2dq-6RR6OLKtGRjffz1TmJ3oIGhtKEy934VaVY8kgvoOGDnsnEBKZdqeI5uvUTe1lu4XrHfkBfaqkkeWJYwUh4RXJa6vK9eygGQWMTiIUmgVE66Iyzuk3cwKw~Mv0GkdJyIzVaXA__&Key-Pair-Id=KK4HN3OO4AT5R",
        w720: "https://cdn.movieofthenight.com/show/5059481/poster/horizontal/en/720.jpg?Expires=1769117297&Signature=k-ACzdwhS8p0gtzkG90Fuy8ojJkD~KeGYOQkBe5SN~6WlXNOJ3BZJ~jXuZN~veBrpbaQk0ERhq6wSx7QprvYygxIkAXhhJtKoIoMCE~WLcbpeCg42dTbbigpsxddBM60Wo3uOetYLhencJRrKZdZgw0e-Gjm0-7HlMRI~54Z45ne7G6AOQ6b-ObZ-DqI0rqRSaW5sem1r4giNi5I3IC4bFLpPUvOPB96NrITlky7Y5CAkY-J4oKCcMgKL8kiuKUdCxDt144LgB-9KUTuDXv9lRyN4m0Psvn4lotqGzmeDXvFvZytlaKoENJ783BTFd0ZqyS08i2YyOZ6lMVCK8RlAA__&Key-Pair-Id=KK4HN3OO4AT5R",
        w1080: "https://cdn.movieofthenight.com/show/5059481/poster/horizontal/en/1080.jpg?Expires=1769117297&Signature=Le5XbvCgIsAr1Lwmk5bOkzg4LTARaAVfNIhxWWRPdzRuN2V~auQdioXCUKAemGOnqFNz~Ux4liSviT8wYK0ALNfY43O8r5JBiPlAK~UEuLKvrur~Dg~ED8FvCH2Q89BWsc~XVA1FCK-CVJ7vNn6~ihkXCmnuEDSd7DLoAlst75ZFCSatSu-4NFc8-qxpYiP9~JwDVtF8uqe71jjY0vpOwYzyRmYTId9cFxnz4zr4-hEv9dULLNtDi3-WdI6TnA8Yq5e94xa8OgL2A6d-ZlPsNgF-pRIntq7YWg9r2512eCcxd7TqaK56AOSyMuldOSTn6CUPzXplBDdiwpvBv5sSpA__&Key-Pair-Id=KK4HN3OO4AT5R",
        w1440: "https://cdn.movieofthenight.com/show/5059481/poster/horizontal/en/1440.jpg?Expires=1769117297&Signature=dt4R0CKdJCiwTJipIpdOXtII3w34oHpGPocX7-J9ZPGvnGvmbeCalcnkaJXa7ehhZA3Mm0NJqM2JjJs6DtemrNeOhlhuDnh5vGMLyEKhsZtqDlmBJXyry9a5vW6JcJmzjOJXIDqrHZ7Xt0yol6IOwy95ztGjBanABKGpwaDbim-39Do1UXhsHCWEkJAcghv60B9ZORC24eD7MgZ7dzXY5oY7-KtX-gqcZMvPWtChOKgnVhCr3mIIQdekvG-soVeHjX-1JWfzh4~u9sli19JHh91W95-aNZV2ybYCDmyy7SxnxY0IHRnT6DocrJtT7HuZ7XyaxRcslxXvmbVoPe5oMw__&Key-Pair-Id=KK4HN3OO4AT5R"
      },
      horizontalBackdrop: {
        w360: "https://cdn.movieofthenight.com/show/5059481/backdrop/horizontal/360.jpg?Expires=1769117295&Signature=OUK4mnDHsET3FPXQ06RfZQpPrdWUpc8rkreB~KTte4WJGb2rZnOOGD0x-D1OtPfOsjAC8Q~-Pg13IVnWmTGaJPwj3CEVZcLb4KwmQ7pbKudfaGZl3nKH0yI-9vmYjlgae4UGeKbsEgZgElQSmPHjs~7M2~st2ooqVj19ix6d0LwncFk~yX610r-VnaEP5u1ft-F~cjaw0GtG4CWTbhy3WJPu0qDn-y~Dg4BktrkkJOZlTCGJOTIOtoUiXHlna-tFYOdtWyv7pKL3x9YYHAkWNgdA1OpRcA7~LFxQ5ot26ASzAw3hrIGBvr~xxjo88M5OsHypcuNrdglvFmqQD~AIUg__&Key-Pair-Id=KK4HN3OO4AT5R",
        w480: "https://cdn.movieofthenight.com/show/5059481/backdrop/horizontal/480.jpg?Expires=1769117295&Signature=DQ-APxBIYffmR4MfT6es3w6vSXIY9V4uNh-0qNcd0tOUcaF1u~lD1jOfdhjxgjSmOlGqOEatm2W~0qEpYojfMEdPXJqTHdbjtuZLLDd02S5UHmNXBgH4RhnZGukZ9lgCHrAAj7jKpu8wGPMGSHFNdlGeYScmepAE7knT52RRT57ZbhCSxtvgw~OfEuJrnhH1asxrZOn8p-ypkxErPMsTGTcIosDCfhkGmLD709ggXkTXQMOonq2nOdG8ORTxbGiGItMd9EeMTlYQP~Diqjfq0HfZifhckoSjdZO7DWDKaMyV0u7~Ehf~czJtv3u~lRkAuntZgdRLr0hGFQvzlKgBlg__&Key-Pair-Id=KK4HN3OO4AT5R",
        w720: "https://cdn.movieofthenight.com/show/5059481/backdrop/horizontal/720.jpg?Expires=1769117295&Signature=DIXwc1hp4ZbWewKolFURwJIVJ48-tMNRVEUl2idyjR-6bM66vpzPMRY1CEK8wEbGFNQps~n9LzGlxneZLhbhNwxWZwzsvDoC7G~qVeoLM~DGKEDtEosQDpLNlsgTbpbJ1EqO8YcGH8PhQH4QujO-DmRzR2eqVbyPqAkjp4HyA3-8PsKW0uw2-m7AalUFS8m-CaQTM01w-uTQFm9vbsooePEz7qGJ1yA5LVQ~vIu5An0Q~JWddnQB2Xpdc4I8Nxb-YBSL01HalGcvMI24IdymmW~xfuQszejd~CNzjl3Gh9jBcuPboID-AtMrkSRqjfWVFzFQA67zm8ladAohr3iNqw__&Key-Pair-Id=KK4HN3OO4AT5R",
        w1080: "https://cdn.movieofthenight.com/show/5059481/backdrop/horizontal/1080.jpg?Expires=1769117295&Signature=aedPG-zHx~3cKx7qojJdlFu2Iv5ajRdopW7cjBBu-3c8VeavssQbyXJ0QooK8GvdCIU-AWqNxMK3fkTqcbImyeilPX54OQUMzq5vx-8CjX3mg5zXAZo6-k3obL2bhiYqP0Vwbaer6qB5G9xM0EN-83vXPxXmPZEGWO2IUsl74d4i1y4Z4I0-A95uLELtKJ4FhBOP6OYHsGfzP6qri03peBlDhoAkkr5curJTvqgTIAqbno6fN9uf21-nd0ndJatnWtUGWhr~RehGWXuXT~Mfu0nxtL78wfVGw2cELnwaQjLe9~TJcxUfsdGVgVcNNmD6i1jQ-09SE5yOk4za7NmImQ__&Key-Pair-Id=KK4HN3OO4AT5R",
        w1440: "https://cdn.movieofthenight.com/show/5059481/backdrop/horizontal/1440.jpg?Expires=1769117295&Signature=lNYDVgBuGJ2b6UGUHdSWsKGUNwlZz1Faq9slk-EHbjuDMLuF84W7bLE9a4VERFosqzdOxCZrqjIgGl9G1em~rGvQRQA~n41xvxIrPQbwN9TnLP1-dfhbnzLmuPKnF4LjgRJlmnKGPkwXqLyGvkkG9KHMNPY8oiZhvY3GoN45gTkWAZNoBHNx5-MFhOrAIdXiLelVoXyxytAUtrox3YrFdEvTR-kRcvZw9jAczl--ArPeFnVnuMscIdJK2AbpFdTpf8xevGRkKhBL2M6azPUZiHGyp6QrFupzyw~CoKLppB0sKw1O45lScoPOOydfVGn2xbUQ0D1B9LtLiTWjevFasQ__&Key-Pair-Id=KK4HN3OO4AT5R"
      }
    },
    streamingOptions: {
      us: [
        {
          service: [Object],
          type: "subscription",
          link: "https://www.netflix.com/title/81726714/",
          videoLink: "https://www.netflix.com/watch/81726714",
          quality: "hd",
          audios: [Array],
          subtitles: [Array],
          expiresSoon: false,
          availableSince: 1741279809
        },
        {
          service: [Object],
          type: "buy",
          link: "https://www.amazon.com/gp/video/detail/B0CJQFBHQG",
          quality: "sd",
          audios: [Array],
          subtitles: [],
          expiresSoon: false,
          availableSince: 1716971046
        },
        {
          service: [Object],
          type: "buy",
          link: "https://www.amazon.com/gp/video/detail/B0CJYLR1TH",
          quality: "hd",
          audios: [Array],
          subtitles: [Array],
          expiresSoon: false,
          availableSince: 1717533253
        },
        {
          service: [Object],
          type: "buy",
          link: "https://www.amazon.com/gp/video/detail/B0CWDMQRDB",
          quality: "hd",
          audios: [Array],
          subtitles: [Array],
          expiresSoon: false,
          availableSince: 1716871418
        },
        {
          service: [Object],
          type: "buy",
          link: "https://www.amazon.com/gp/video/detail/B0CWDMQRDB",
          quality: "sd",
          audios: [Array],
          subtitles: [Array],
          expiresS ....[truncated]*/