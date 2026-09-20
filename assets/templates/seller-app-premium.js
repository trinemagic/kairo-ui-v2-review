/* KAIRO v20.10.144 — Seller pre-launch UI + receipt source-of-truth fixes */
(function(){
  'use strict';

  // Shared core compatibility: Seller still persists into these legacy transaction columns.
  // Keep the DB names isolated here so Seller logic uses neutral Seller terminology elsewhere.
  const SELLER_LEGACY_FIELDS=Object.freeze({startedAt:'reading_started_at',status:'reading_status'});
  const sellerStartedAt=tx=>tx?.[SELLER_LEGACY_FIELDS.startedAt]||tx?.created_at||null;
  const sellerBackendStatus=next=>String(next||'').toLowerCase()==='done'?'done':'on_progress';
  if(window.__KAIRO_SELLER_APP_PREMIUM_V144__) return;
  window.__KAIRO_SELLER_APP_PREMIUM_V144__ = true;

  const CATALOG = [{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"1 hari","price":6000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"3 hari","price":12000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"7 hari","price":18000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"14 hari","price":30000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"1 bulan","price":45000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"2 bulan","price":85000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P1U","duration":"3 bulan","price":125000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"3 hari","price":8000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"14 hari","price":25000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"1 bulan","price":30000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"2 bulan","price":55000},{"category":"Streaming Apps","product":"NETFLIX","variant":"1P2U","duration":"3 bulan","price":85000},{"category":"Streaming Apps","product":"NETFLIX","variant":"SEMPRIV","duration":"1 bulan","price":55000},{"category":"Streaming Apps","product":"NETFLIX","variant":"ANTI LIMIT","duration":"1 bulan","price":60000},{"category":"Streaming Apps","product":"NETFLIX","variant":"SINGLESCREEN","duration":"1 bulan","price":65000},{"category":"Streaming Apps","product":"NETFLIX","variant":"PRIVATE","duration":"1 bulan (RVISA)","price":180000},{"category":"Streaming Apps","product":"NETFLIX","variant":"PRIVATE","duration":"1 bulan (LEGAL)","price":200000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"1 hari","price":4000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"3 hari","price":8000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"7 hari","price":12000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"1 bulan (4U - 5U)","price":15000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"1 bulan (3U)","price":20000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"SHARING","duration":"1 bulan (2U)","price":25000},{"category":"Streaming Apps","product":"AMAZON PRIME","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"FAMPLAN","duration":"1 bulan","price":12000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"FAMPLAN","duration":"2 bulan","price":20000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"INDPLAN","duration":"1 bulan","price":20000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"INDPLAN","duration":"3 bulan (RENEW)","price":45000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"INDPLAN","duration":"3 bulan (NO RENEW)","price":60000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"MIXPLAN","duration":"3 bulan","price":45000},{"category":"Streaming Apps","product":"YOUTUBE","variant":"MIXPLAN","duration":"4 bulan","price":55000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (ALL DEVICES)","duration":"1 hari","price":10000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (ALL DEVICES)","duration":"3 hari","price":15000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (ALL DEVICES)","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (ALL DEVICES)","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (ALL DEVICES)","duration":"1 hari","price":12000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (ALL DEVICES)","duration":"3 hari","price":18000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (ALL DEVICES)","duration":"7 hari","price":25000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (ALL DEVICES)","duration":"1 bulan","price":55000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (MOBILE)","duration":"1 hari","price":7000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (MOBILE)","duration":"3 hari","price":12000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (MOBILE)","duration":"7 hari","price":18000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (MOBILE)","duration":"1 bulan","price":30000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (MOBILE)","duration":"1 hari","price":10000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (MOBILE)","duration":"3 hari","price":15000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (MOBILE)","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (MOBILE)","duration":"1 bulan","price":40000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (TV ONLY)","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (TV ONLY)","duration":"3 hari","price":10000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (TV ONLY)","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"VIDIO","variant":"SHARING 2U (TV ONLY)","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (TV ONLY)","duration":"1 hari","price":8000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (TV ONLY)","duration":"3 hari","price":12000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (TV ONLY)","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"VIDIO","variant":"PRIVATE (TV ONLY)","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"VIDIO","variant":"PLATINUM EXTRA PRIVATE","duration":"1 bulan alldev","price":70000},{"category":"Streaming Apps","product":"VIDIO","variant":"PLATINUM EXTRA PRIVATE","duration":"1 bulan mobile","price":50000},{"category":"Streaming Apps","product":"VIDIO","variant":"ULTIMATE SHARING","duration":"1 bulan alldev","price":87000},{"category":"Streaming Apps","product":"VIDIO","variant":"ULTIMATE SHARING","duration":"1 bulan mobile","price":55000},{"category":"Streaming Apps","product":"VIDIO","variant":"ULTIMATE PRIVATE","duration":"1 bulan mobile","price":95000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 hari 6U","price":5000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"3 hari 6U","price":12000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"5 hari 6U","price":15000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"7 hari 6U","price":20000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 hari 3U","price":10000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"3 hari 3U","price":15000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"5 hari 3U","price":20000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"7 hari 3U","price":25000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 bulan 6U","price":35000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 bulan 5U","price":40000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 bulan 4U","price":46000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PREMIUM PLAN","duration":"1 bulan 3U","price":60000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"1 hari 3U","price":4000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"3 hari 3U","price":9000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"5 hari 3U","price":13000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"7 hari 3U","price":16000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"1 bulan 3U","price":35000},{"category":"Streaming Apps","product":"DISNEY+","variant":"BASIC PLAN","duration":"1 bulan 2U","price":45000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PRIVATE","duration":"1 bulan (premium)","price":160000},{"category":"Streaming Apps","product":"DISNEY+","variant":"PRIVATE","duration":"1 bulan (basic)","price":90000},{"category":"Streaming Apps","product":"HBO","variant":"HBO STANDAR SHARING","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"HBO","variant":"HBO STANDAR SHARING","duration":"3 hari","price":8000},{"category":"Streaming Apps","product":"HBO","variant":"HBO STANDAR SHARING","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"HBO","variant":"HBO STANDAR SHARING","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM SHARING","duration":"1 hari (8U)","price":7000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM SHARING","duration":"3 hari (8U)","price":12000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM SHARING","duration":"7 hari (8U)","price":20000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM SHARING","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM ANLIM","duration":"1 hari","price":8000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM ANLIM","duration":"3 hari","price":18000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM ANLIM","duration":"7 hari","price":25000},{"category":"Streaming Apps","product":"HBO","variant":"HBO ULTIMATE/PREMIUM ANLIM","duration":"1 bulan (sharing)","price":45000},{"category":"Streaming Apps","product":"HBO","variant":"HBO PRIVATE","duration":"1 bulan (standar)","price":75000},{"category":"Streaming Apps","product":"HBO","variant":"HBO PRIVATE","duration":"1 bulan (ultimate/premium)","price":125000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"1 hari","price":3000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"3 hari","price":6000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"7 hari","price":10000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"2 bulan","price":20000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"3 bulan","price":25000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"6 bulan","price":40000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE ANLIM","duration":"1 tahun","price":50000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"1 hari","price":2000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"3 hari","price":4000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"7 hari","price":8000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"1 bulan","price":10000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"2 bulan","price":15000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"3 bulan","price":20000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"6 bulan","price":30000},{"category":"Streaming Apps","product":"VIU","variant":"VIU PRIVATE BIASA","duration":"1 tahun","price":40000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"1 hari","price":4000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"3 hari","price":7000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"7 hari","price":10000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"3 bulan","price":25000},{"category":"Streaming Apps","product":"YOUKU","variant":"SHARING","duration":"1 tahun","price":45000},{"category":"Streaming Apps","product":"YOUKU","variant":"PRIVATE","duration":"1 bulan","price":45000},{"category":"Streaming Apps","product":"YOUKU","variant":"PRIVATE","duration":"3 bulan","price":85000},{"category":"Streaming Apps","product":"YOUKU","variant":"PRIVATE","duration":"1 tahun","price":245000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"1 hari (3U)","price":5000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"3 hari (3U)","price":8000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"5 hari (3U)","price":11000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"7 hari (3U)","price":15000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"1 bulan (3U)","price":27000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC SHARING","duration":"1 bulan (4U)","price":25000},{"category":"Streaming Apps","product":"LOKLOK","variant":"STANDARD SHARING","duration":"1 hari","price":8000},{"category":"Streaming Apps","product":"LOKLOK","variant":"STANDARD SHARING","duration":"3 hari","price":12000},{"category":"Streaming Apps","product":"LOKLOK","variant":"STANDARD SHARING","duration":"7 hari","price":17000},{"category":"Streaming Apps","product":"LOKLOK","variant":"STANDARD SHARING","duration":"14 hari","price":26000},{"category":"Streaming Apps","product":"LOKLOK","variant":"STANDARD SHARING","duration":"1 bulan","price":30000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC PRIVATE","duration":"1 hari","price":7000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC PRIVATE","duration":"3 hari","price":15000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC PRIVATE","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC PRIVATE","duration":"11 hari","price":25000},{"category":"Streaming Apps","product":"LOKLOK","variant":"BASIC PRIVATE","duration":"1 bulan","price":60000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"1 hari (6U)","price":5000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"3 hari (6U)","price":7000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"7 hari (6U)","price":10000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"1 bulan (8U)","price":14000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"1 bulan (5U-6U)","price":15000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"1 bulan (3U / ANLIM)","price":25000},{"category":"Streaming Apps","product":"WE TV","variant":"SHARING","duration":"3 bulan (5U-6U)","price":30000},{"category":"Streaming Apps","product":"WE TV","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"1 hari (5U)","price":4000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"3 hari (5U)","price":8000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"5 hari (5U)","price":10000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"3 bulan","price":30000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"1 tahun","price":40000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING STANDARD","duration":"1 bulan (ANLIM)","price":25000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"3 hari","price":10000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"5 hari","price":12000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"3 bulan","price":40000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"1 tahun","price":55000},{"category":"Streaming Apps","product":"IQIYI","variant":"SHARING PREMIUM","duration":"1 bulan (ANLIM)","price":30000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"SHARING","duration":"7 hari","price":12000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"SHARING","duration":"14 hari","price":16000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"SHARING","duration":"1 tahun","price":35000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"PRIVATE","duration":"7 hari","price":18000},{"category":"Streaming Apps","product":"CRUNCHYROLL","variant":"PRIVATE","duration":"14 hari","price":24000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"3 hari","price":8000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"7 hari","price":11000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"3 bulan","price":25000},{"category":"Streaming Apps","product":"BSTATION","variant":"SHARING","duration":"1 tahun","price":45000},{"category":"Streaming Apps","product":"BSTATION","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Streaming Apps","product":"RCTI","variant":"SHARING","duration":"1 hari (2U)","price":6000},{"category":"Streaming Apps","product":"RCTI","variant":"3 hari (2U) 12k","duration":"7 hari (2U)","price":15000},{"category":"Streaming Apps","product":"RCTI","variant":"PRIVATE","duration":"1 hari","price":8000},{"category":"Streaming Apps","product":"RCTI","variant":"PRIVATE","duration":"3 hari","price":15000},{"category":"Streaming Apps","product":"RCTI","variant":"PRIVATE","duration":"7 hari","price":24000},{"category":"Streaming Apps","product":"RCTI","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"VISION","variant":"SHARING PAYTV","duration":"1 hari (2U)","price":6000},{"category":"Streaming Apps","product":"VISION","variant":"3 hari (2U) 10k","duration":"7 hari (2U)","price":15000},{"category":"Streaming Apps","product":"VISION","variant":"3 hari (2U) 10k","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"VISION","variant":"PRIVATE PAYTV","duration":"1 hari","price":10000},{"category":"Streaming Apps","product":"VISION","variant":"PRIVATE PAYTV","duration":"3 hari","price":15000},{"category":"Streaming Apps","product":"VISION","variant":"PRIVATE PAYTV","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"VISION","variant":"PRIVATE PAYTV","duration":"1 bulan","price":50000},{"category":"Streaming Apps","product":"GAGAOLALA","variant":"SHARING","duration":"1 hari","price":5000},{"category":"Streaming Apps","product":"GAGAOLALA","variant":"SHARING","duration":"3 hari","price":7000},{"category":"Streaming Apps","product":"GAGAOLALA","variant":"SHARING","duration":"7 hari","price":12000},{"category":"Streaming Apps","product":"GAGAOLALA","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Streaming Apps","product":"GAGAOLALA","variant":"SHARING","duration":"3 bulan","price":30000},{"category":"Streaming Apps","product":"MANGO TV","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"1 hari","price":8000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"3 bulan","price":30000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"6 bulan","price":35000},{"category":"Streaming Apps","product":"MELOLO","variant":"SHARING","duration":"1 tahun","price":40000},{"category":"Streaming Apps","product":"MELOLO","variant":"PRIVATE","duration":"7 hari","price":30000},{"category":"Streaming Apps","product":"MELOLO","variant":"PRIVATE","duration":"1 bulan","price":55000},{"category":"Streaming Apps","product":"DRAMAWAVE","variant":"SHARING LOGIN APP","duration":"1 hari","price":15000},{"category":"Streaming Apps","product":"DRAMAWAVE","variant":"SHARING LOGIN APP","duration":"7 hari","price":55000},{"category":"Streaming Apps","product":"DRAMAWAVE","variant":"PRIVATE LOGIN WEB","duration":"7 hari","price":35000},{"category":"Streaming Apps","product":"DRAMAWAVE","variant":"PRIVATE LOGIN WEB","duration":"1 bulan","price":70000},{"category":"Streaming Apps","product":"REELSHORT","variant":"SHARING LOGIN APP","duration":"1 bulan","price":20000},{"category":"Streaming Apps","product":"REELSHORT","variant":"SHARING LOGIN APP","duration":"3 bulan","price":38000},{"category":"Streaming Apps","product":"REELSHORT","variant":"SHARING LOGIN APP","duration":"6 bulan","price":58000},{"category":"Streaming Apps","product":"REELSHORT","variant":"SHARING LOGIN APP","duration":"1 tahun","price":84000},{"category":"Streaming Apps","product":"DRAMABOX","variant":"SHARING","duration":"7 hari","price":15000},{"category":"Streaming Apps","product":"DRAMABOX","variant":"SHARING","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"DRAMABOX","variant":"SHARING","duration":"3 bulan","price":60000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN APP","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN APP","duration":"1 bulan","price":25000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN APP","duration":"3 bulan","price":45000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN APP","duration":"6 bulan","price":60000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN APP","duration":"1 tahun","price":90000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN WEB","duration":"7 hari","price":20000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"SHARING LOGIN WEB","duration":"1 bulan","price":35000},{"category":"Streaming Apps","product":"SHORTMAX","variant":"PRIVATE LOGIN WEB","duration":"1 bulan","price":75000},{"category":"Streaming Apps","product":"NETSHORT","variant":"SHARING LOGIN WEB","duration":"7 hari","price":25000},{"category":"Streaming Apps","product":"NETSHORT","variant":"SHARING LOGIN WEB","duration":"1 bulan","price":40000},{"category":"Streaming Apps","product":"VIKI","variant":"SHARING","duration":"1 bulan (plus)","price":20000},{"category":"Streaming Apps","product":"VIKI","variant":"SHARING","duration":"1 bulan (standard)","price":18000},{"category":"Streaming Apps","product":"VIKI","variant":"PRIVATE","duration":"7 hari","price":18000},{"category":"Streaming Apps","product":"VIKI","variant":"PRIVATE","duration":"1 bulan (plus)","price":40000},{"category":"Streaming Apps","product":"VIKI","variant":"PRIVATE","duration":"1 bulan (standard)","price":30000},{"category":"Streaming Apps","product":"DRAKOR ID","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Streaming Apps","product":"DRAKOR ID","variant":"SHARING","duration":"3 bulan","price":35000},{"category":"Streaming Apps","product":"DRAKOR ID","variant":"SHARING","duration":"1 tahun","price":45000},{"category":"Streaming Apps","product":"DRAKOR ID","variant":"PRIVATE","duration":"1 bulan","price":30000},{"category":"Streaming Apps","product":"DRAKOR ID","variant":"PRIVATE","duration":"3 bulan","price":40000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 8U","duration":"1 hari","price":10000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 8U","duration":"3 hari","price":15000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 8U","duration":"7 hari","price":20000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 8U","duration":"1 bulan","price":40000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 8U","duration":"3 bulan","price":85000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 5U","duration":"1 hari","price":15000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 5U","duration":"3 hari","price":20000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 5U","duration":"7 hari","price":30000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 5U","duration":"1 bulan","price":55000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 3U","duration":"1 hari","price":18000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 3U","duration":"3 hari","price":25000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 3U","duration":"7 hari","price":35000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"SHARING 3U","duration":"1 bulan","price":65000},{"category":"Education Apps","product":"CHATGPT PLUS","variant":"PRIVATE","duration":"1 bulan","price":170000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"SHARING 3U","duration":"7 hari","price":65000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"SHARING 3U","duration":"1 bulan","price":170000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"SHARING 5U","duration":"7 hari","price":60000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"SHARING 5U","duration":"1 bulan","price":150000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"PRIVATE","duration":"7 hari","price":140000},{"category":"Education Apps","product":"CLAUDE PRO","variant":"PRIVATE","duration":"1 bulan","price":400000},{"category":"Education Apps","product":"GROK AI","variant":"PRIVATE","duration":"7 hari","price":35000},{"category":"Education Apps","product":"GEMINI AI","variant":"SHARING 5U","duration":"1 bulan","price":25000},{"category":"Education Apps","product":"GEMINI AI","variant":"FAMPLAN / INVITE","duration":"1 bulan","price":25000},{"category":"Education Apps","product":"GEMINI AI","variant":"FAMPLAN / INVITE","duration":"2 bulan","price":40000},{"category":"Education Apps","product":"GEMINI AI","variant":"FAMPLAN / INVITE","duration":"3 bulan","price":55000},{"category":"Education Apps","product":"GEMINI AI","variant":"FAMPLAN / INVITE","duration":"6 bulan","price":95000},{"category":"Education Apps","product":"GEMINI AI","variant":"FAMPLAN / INVITE","duration":"1 tahun","price":120000},{"category":"Education Apps","product":"KIRO AI","variant":"PRIVATE","duration":"14 hari","price":50000},{"category":"Education Apps","product":"PERPLEXITY AI","variant":"SHARING 5U","duration":"1 hari","price":8000},{"category":"Education Apps","product":"PERPLEXITY AI","variant":"SHARING 5U","duration":"3 hari","price":15000},{"category":"Education Apps","product":"PERPLEXITY AI","variant":"SHARING 5U","duration":"7 hari","price":23000},{"category":"Education Apps","product":"PERPLEXITY AI","variant":"SHARING 5U","duration":"1 bulan","price":40000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"FAMPLAN / INVITE","duration":"1 bulan","price":15000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"FAMPLAN / INVITE","duration":"2 bulan","price":25000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"FAMPLAN / INVITE","duration":"3 bulan","price":30000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"FAMPLAN / INVITE","duration":"6 bulan","price":55000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"FAMPLAN / INVITE","duration":"1 tahun","price":60000},{"category":"Education Apps","product":"MICROSOFT 365","variant":"HEAD","duration":"1 bulan","price":45000},{"category":"Education Apps","product":"GOODNOTES IOS","variant":"Standard","duration":"1 tahun","price":30000},{"category":"Education Apps","product":"GOODNOTES IOS","variant":"Standard","duration":"Lifetime (garansi 6b)","price":40000},{"category":"Education Apps","product":"GOODNOTES IOS","variant":"Standard","duration":"Lifetime (full garansi)","price":45000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"1 hari","price":7000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"3 hari","price":10000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"7 hari","price":15000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"1 bulan","price":20000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"3 bulan","price":40000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"FAMPLAN / INVITE","duration":"6 bulan","price":70000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"INDIVIDUAL PLAN","duration":"14 hari","price":18000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"INDIVIDUAL PLAN","duration":"1 bulan","price":30000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"INDIVIDUAL PLAN","duration":"3 bulan","price":45000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"INDIVIDUAL PLAN","duration":"6 bulan","price":60000},{"category":"Education Apps","product":"DUOLINGO SUPER","variant":"HEAD","duration":"1 bulan","price":45000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 8U","duration":"7 hari","price":15000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 8U","duration":"1 bulan","price":25000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 5U","duration":"1 hari","price":5000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 5U","duration":"3 hari","price":7000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 5U","duration":"7 hari","price":15000},{"category":"Education Apps","product":"QUILLBOT","variant":"SHARING 5U","duration":"1 bulan","price":30000},{"category":"Education Apps","product":"QUILLBOT","variant":"PRIVATE","duration":"1 bulan","price":60000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 5U","duration":"1 hari","price":6000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 5U","duration":"3 hari","price":10000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 5U","duration":"7 hari","price":25000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 8U","duration":"7 hari","price":20000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 8U","duration":"1 bulan","price":25000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 8U","duration":"2 bulan","price":35000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 8U","duration":"3 bulan","price":65000},{"category":"Education Apps","product":"GRAMMARLY","variant":"SHARING 8U","duration":"1 tahun","price":75000},{"category":"Education Apps","product":"GRAMMARLY","variant":"PRIVATE","duration":"1 bulan","price":55000},{"category":"Education Apps","product":"GRAMMARLY","variant":"PRIVATE","duration":"2 bulan","price":65000},{"category":"Education Apps","product":"GRAMMARLY","variant":"PRIVATE","duration":"3 bulan","price":75000},{"category":"Education Apps","product":"GRAMMARLY","variant":"PRIVATE","duration":"6 bulan","price":100000},{"category":"Education Apps","product":"GRAMMARLY","variant":"EDUCATION","duration":"2 bulan","price":35000},{"category":"Education Apps","product":"SCRIBD","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Education Apps","product":"SCRIBD","variant":"SHARING","duration":"2 bulan","price":20000},{"category":"Education Apps","product":"SCRIBD","variant":"SHARING","duration":"3 bulan","price":28000},{"category":"Education Apps","product":"SCRIBD","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Education Apps","product":"WPS OFFICE","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Education Apps","product":"WPS OFFICE","variant":"SHARING","duration":"1 tahun","price":30000},{"category":"Education Apps","product":"WPS OFFICE","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING","duration":"1 hari","price":7000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING","duration":"3 hari","price":10000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING","duration":"7 hari","price":15000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING","duration":"14 hari","price":25000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING 3U","duration":"1 bulan","price":30000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING 3U","duration":"2 bulan","price":50000},{"category":"Education Apps","product":"DEEPL PRO","variant":"SHARING 3U","duration":"3 bulan","price":65000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"1 hari","price":11000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"3 hari","price":15000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"7 hari","price":25000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"14 hari","price":35000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"2 bulan","price":70000},{"category":"Education Apps","product":"DEEPL PRO","variant":"PRIVATE","duration":"3 bulan","price":90000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 3U","duration":"1 hari","price":8000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 3U","duration":"3 hari","price":12000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 3U","duration":"7 hari","price":17000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 3U","duration":"1 bulan","price":35000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 2U","duration":"1 hari","price":9000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 2U","duration":"3 hari","price":15000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 2U","duration":"7 hari","price":20000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"SHARING 2U","duration":"1 bulan","price":45000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"PRIVATE","duration":"1 hari","price":10000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"PRIVATE","duration":"3 hari","price":18000},{"category":"Editing Apps","product":"CAPCUT PRO","variant":"PRIVATE","duration":"7 hari","price":25000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"1 hari","price":3000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"3 hari","price":5000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"7 hari","price":7000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"1 bulan","price":12000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"2 bulan","price":14000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"3 bulan","price":17000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"4 bulan","price":20000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"5 bulan","price":24000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"6 bulan","price":27000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"1 tahun garansi 6 bulan","price":32000},{"category":"Editing Apps","product":"CANVA","variant":"MEMBER","duration":"1 tahun full garansi","price":37000},{"category":"Editing Apps","product":"CANVA","variant":"EDUCATION","duration":"Lifetime garansi 6 bulan","price":34000},{"category":"Editing Apps","product":"CANVA","variant":"EDUCATION","duration":"Lifetime garansi 12 bulan","price":40000},{"category":"Editing Apps","product":"DAZZCAM IOS","variant":"LIFETIME","duration":"Garansi 6 bulan","price":30000},{"category":"Editing Apps","product":"DAZZCAM IOS","variant":"LIFETIME","duration":"Garansi 1 tahun","price":45000},{"category":"Editing Apps","product":"CAMSCANNER","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Editing Apps","product":"CAMSCANNER","variant":"SHARING","duration":"6 bulan","price":35000},{"category":"Editing Apps","product":"CAMSCANNER","variant":"SHARING","duration":"1 tahun","price":40000},{"category":"Editing Apps","product":"CAMSCANNER","variant":"PRIVATE","duration":"1 bulan","price":30000},{"category":"Editing Apps","product":"ALIGHT MOTION","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Editing Apps","product":"ALIGHT MOTION","variant":"SHARING","duration":"1 tahun","price":30000},{"category":"Editing Apps","product":"ALIGHT MOTION","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Editing Apps","product":"ALIGHT MOTION","variant":"PRIVATE","duration":"1 tahun","price":50000},{"category":"Editing Apps","product":"BEAUTY PLUS","variant":"IOS","duration":"Lifetime garansi 6 bulan","price":33000},{"category":"Editing Apps","product":"BEAUTY PLUS","variant":"ANDROID","duration":"Lifetime garansi 6 bulan","price":33000},{"category":"Editing Apps","product":"BEAUTY PLUS","variant":"ANDROID","duration":"Lifetime garansi 1 tahun","price":40000},{"category":"Editing Apps","product":"PICSART","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Editing Apps","product":"PICSART","variant":"PRIVATE","duration":"1 bulan","price":25000},{"category":"Editing Apps","product":"IBIS PAINT","variant":"SHARING","duration":"6 bulan","price":30000},{"category":"Editing Apps","product":"IBIS PAINT","variant":"SHARING","duration":"1 tahun","price":40000},{"category":"Editing Apps","product":"INSHOT","variant":"SHARING","duration":"Lifetime garansi 1 tahun","price":40000},{"category":"Editing Apps","product":"LIGHTROOM","variant":"SHARING","duration":"1 tahun","price":40000},{"category":"Editing Apps","product":"MEITU","variant":"SHARING","duration":"VIP 7 hari","price":15000},{"category":"Editing Apps","product":"MEITU","variant":"SHARING","duration":"VIP+ 7 hari","price":25000},{"category":"Editing Apps","product":"MEITU","variant":"PRIVATE","duration":"VIP 7 hari","price":25000},{"category":"Editing Apps","product":"MEITU","variant":"PRIVATE","duration":"VIP+ 7 hari","price":35000},{"category":"Editing Apps","product":"OLDROLL","variant":"LIFETIME","duration":"Garansi 6 bulan","price":35000},{"category":"Editing Apps","product":"OLDROLL","variant":"LIFETIME","duration":"Garansi 1 tahun","price":45000},{"category":"Editing Apps","product":"PROCREATE","variant":"LIFETIME","duration":"Garansi 6 bulan","price":35000},{"category":"Editing Apps","product":"PROCREATE","variant":"LIFETIME","duration":"Garansi 1 tahun","price":40000},{"category":"Editing Apps","product":"REMINI","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Editing Apps","product":"REMINI","variant":"SHARING","duration":"1 tahun","price":40000},{"category":"Editing Apps","product":"REMINI","variant":"PRIVATE","duration":"7 hari","price":14000},{"category":"Editing Apps","product":"REMINI","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Editing Apps","product":"VSCO","variant":"SHARING PLUS","duration":"6 bulan","price":25000},{"category":"Editing Apps","product":"VSCO","variant":"SHARING PLUS","duration":"1 tahun","price":35000},{"category":"Editing Apps","product":"VSCO","variant":"SHARING PRO","duration":"1 tahun","price":45000},{"category":"Editing Apps","product":"WINK","variant":"SHARING","duration":"7 hari","price":20000},{"category":"Editing Apps","product":"WINK","variant":"SHARING","duration":"1 bulan","price":38000},{"category":"Editing Apps","product":"WINK","variant":"PRIVATE","duration":"7 hari","price":25000},{"category":"Editing Apps","product":"WINK","variant":"PRIVATE","duration":"1 bulan","price":60000},{"category":"Music Apps","product":"APPLE MUSIC","variant":"FAMPLAN","duration":"1 bulan","price":23000},{"category":"Music Apps","product":"APPLE MUSIC","variant":"FAMPLAN","duration":"2 bulan","price":30000},{"category":"Music Apps","product":"APPLE MUSIC","variant":"FAMPLAN","duration":"3 bulan","price":38000},{"category":"Music Apps","product":"APPLE MUSIC","variant":"FAMPLAN","duration":"4 bulan","price":43000},{"category":"Music Apps","product":"APPLE MUSIC","variant":"INDIVIDUAL PLAN","duration":"1 bulan","price":30000},{"category":"Music Apps","product":"SPOTIFY","variant":"HARIAN","duration":"1 hari","price":6000},{"category":"Music Apps","product":"SPOTIFY","variant":"HARIAN","duration":"3 hari","price":10000},{"category":"Music Apps","product":"SPOTIFY","variant":"HARIAN","duration":"7 hari","price":18000},{"category":"Music Apps","product":"SPOTIFY","variant":"FAMPLAN","duration":"1 bulan","price":25000},{"category":"Music Apps","product":"SPOTIFY","variant":"FAMPLAN","duration":"2 bulan","price":50000},{"category":"Music Apps","product":"SPOTIFY","variant":"FAMPLAN","duration":"3 bulan","price":70000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN REPLACE","duration":"1 bulan","price":35000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN REPLACE","duration":"2 bulan","price":55000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN REPLACE","duration":"3 bulan","price":75000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN NO REPLACE","duration":"1 bulan","price":45000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN NO REPLACE","duration":"2 bulan","price":58000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN NO REPLACE","duration":"3 bulan","price":160000},{"category":"Music Apps","product":"SPOTIFY","variant":"STUDENT","duration":"1 bulan","price":35000},{"category":"Music Apps","product":"SPOTIFY","variant":"STUDENT","duration":"2 bulan","price":70000},{"category":"Music Apps","product":"SPOTIFY","variant":"STUDENT LEGAL PPJ","duration":"1 bulan","price":35000},{"category":"Music Apps","product":"SPOTIFY","variant":"INDPLAN LEGAL PPJ","duration":"1 bulan","price":45000},{"category":"Other Apps","product":"KILONOTES","variant":"LIFETIME","duration":"Garansi 6 bulan","price":35000},{"category":"Other Apps","product":"WATTPAD","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Other Apps","product":"WATTPAD","variant":"SHARING","duration":"1 tahun garansi 6 bulan","price":35000},{"category":"Other Apps","product":"WATTPAD","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Other Apps","product":"GET CONTACT","variant":"Standard","duration":"1 bulan","price":15000},{"category":"Other Apps","product":"HMA VPN","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Other Apps","product":"HMA VPN","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Other Apps","product":"EXPRESS VPN","variant":"SHARING","duration":"1 bulan","price":25000},{"category":"Other Apps","product":"EXPRESS VPN","variant":"PRIVATE","duration":"1 bulan","price":40000},{"category":"Other Apps","product":"SURFSHARK VPN","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Other Apps","product":"WINDSCRIBE VPN","variant":"SHARING","duration":"1 bulan","price":20000},{"category":"Other Apps","product":"ILOVEPDF","variant":"SHARING","duration":"1 bulan","price":15000},{"category":"Other Apps","product":"ILOVEPDF","variant":"SHARING","duration":"1 tahun","price":35000},{"category":"Other Apps","product":"ILOVEPDF","variant":"PRIVATE","duration":"1 bulan","price":35000},{"category":"Other Apps","product":"ZOOM","variant":"100 PESERTA","duration":"1 jam","price":7000},{"category":"Other Apps","product":"ZOOM","variant":"100 PESERTA","duration":"1 hari","price":15000},{"category":"Other Apps","product":"ZOOM","variant":"100 PESERTA","duration":"7 hari","price":45000},{"category":"Other Apps","product":"ZOOM","variant":"100 PESERTA","duration":"14 hari","price":55000},{"category":"Other Apps","product":"ZOOM","variant":"100 PESERTA","duration":"1 bulan","price":75000},{"category":"Other Apps","product":"ZOOM","variant":"300 PESERTA","duration":"1 jam","price":15000},{"category":"Other Apps","product":"ZOOM","variant":"300 PESERTA","duration":"1 hari","price":35000},{"category":"Other Apps","product":"ZOOM","variant":"300 PESERTA","duration":"7 hari","price":100000},{"category":"Other Apps","product":"ZOOM","variant":"300 PESERTA","duration":"1 bulan","price":185000},{"category":"Other Apps","product":"ZOOM","variant":"500 PESERTA","duration":"1 jam","price":25000},{"category":"Other Apps","product":"ZOOM","variant":"500 PESERTA","duration":"1 hari","price":65000},{"category":"Other Apps","product":"ZOOM","variant":"500 PESERTA","duration":"7 hari","price":250000},{"category":"Other Apps","product":"ZOOM","variant":"500 PESERTA","duration":"1 bulan","price":350000},{"category":"Other Apps","product":"ZOOM","variant":"1000 PESERTA","duration":"1 jam","price":45000},{"category":"Other Apps","product":"ZOOM","variant":"1000 PESERTA","duration":"1 hari","price":115000},{"category":"Other Apps","product":"ZOOM","variant":"1000 PESERTA","duration":"7 hari","price":335000},{"category":"Other Apps","product":"ZOOM","variant":"1000 PESERTA","duration":"1 bulan","price":500000}];
  const PRETTY = {"CHATGPT PLUS":"ChatGPT Plus","CLAUDE PRO":"Claude Pro","GROK AI":"Grok AI","GEMINI AI":"Gemini AI","KIRO AI":"Kiro AI","PERPLEXITY AI":"Perplexity AI","BLACKBOX AI":"Blackbox AI","MICROSOFT 365":"Microsoft 365","GOODNOTES IOS":"Goodnotes iOS","DEEPL PRO":"DeepL Pro","CAPCUT PRO":"CapCut Pro","DAZZCAM IOS":"DazzCam iOS","IBIS PAINT":"ibis Paint","APPLE MUSIC":"Apple Music","GET CONTACT":"GetContact","ILOVEPDF":"iLovePDF","WE TV":"WeTV","IQIYI":"iQIYI","WPS OFFICE":"WPS Office","HMA VPN":"HMA VPN","EXPRESS VPN":"ExpressVPN","SURFSHARK VPN":"Surfshark VPN","WINDSCRIBE VPN":"Windscribe VPN"};
  const ICON_BASE = 'assets/app-logos/seller-app-premium/';
  const CATEGORIES = [...new Set(CATALOG.map(x=>x.category))];
  const rupiahLocal = n=>'Rp'+Math.round(Number(n)||0).toLocaleString('id-ID');
  const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slug = s=>String(s||'').toLowerCase().replace(/\+/g,'plus').replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const pretty = s=>PRETTY[s]||String(s||'').toLowerCase().replace(/(^|\s|\/|-)([a-z])/g,(m,a,b)=>a+b.toUpperCase());
  const rowKey = r=>[r.category,r.product,r.variant,r.duration].join('||');
  const isSellerTx = t=>String(t?.package_code||'').toUpperCase()==='SELLER_APP' || String(t?.topic_name||'').toLowerCase().includes('seller app premium');

  let category='', product='', variant='', duration='', searchQuery='', cart=[], mounted=false;
  let sellerSettings = new Map();
  let sellerSettingsReady = false;
  let sellerCustomerMeta = new Map();
  let historyExpanded = false;
  let sellerHistoryDateFilter = 'today';
  let sellerHistoryCustomFrom = '';
  let sellerHistoryCustomTo = '';
  let settingsCategory = CATEGORIES[0]||'';
  let settingsSearch = '';
  const BASIC_CUSTOM_PRODUCT_LIMIT = 3;

  function sellerPlan(){
    return String((typeof activeWorkspacePlan!=='undefined'&&activeWorkspacePlan)||document.documentElement.dataset.workspacePlan||'basic').toLowerCase();
  }
  function sellerBaseKeys(){return new Set(CATALOG.map(rowKey))}
  function sellerCustomRows(){
    const baseKeys=sellerBaseKeys();
    return [...sellerSettings.values()].filter(x=>!baseKeys.has(x.item_key));
  }
  function sellerCustomProductNames(){
    return new Set(sellerCustomRows().map(x=>String(x.product||'').trim().toUpperCase()).filter(Boolean));
  }
  function sellerCustomLimitText(){
    const names=sellerCustomProductNames();
    return sellerPlan()==='basic'?`Basic: ${names.size}/${BASIC_CUSTOM_PRODUCT_LIMIT} produk custom`:'Produk custom tanpa batas';
  }
  function updateSellerCustomLimitUI(){
    const note=document.getElementById('seller-custom-product-limit');
    if(note)note.textContent=sellerCustomLimitText();
  }

  function effective(base){
    if(!base) return null;
    const saved=sellerSettings.get(rowKey(base));
    return {...base,price:Number(saved?.price ?? base.price ?? 0),cost:Number(saved?.cost ?? 0)};
  }
  function allEffective(){
    const base=CATALOG.map(effective);
    const baseKeys=sellerBaseKeys();
    const custom=[...sellerSettings.values()].filter(x=>!baseKeys.has(x.item_key)).map(x=>({...x,price:Number(x.price||0),cost:Number(x.cost||0),is_custom:true}));
    return [...base,...custom];
  }
  function rows(){
    const source=allEffective();
    if(searchQuery){
      const q=searchQuery.toLowerCase();
      return source.filter(x=>pretty(x.product).toLowerCase().includes(q)||String(x.product).toLowerCase().includes(q));
    }
    return category ? source.filter(x=>x.category===category) : [];
  }
  function products(){
    const seen=new Map();
    rows().forEach(x=>{if(!seen.has(x.product))seen.set(x.product,{product:x.product,category:x.category})});
    return [...seen.values()];
  }
  function variants(){
    return [...new Set(allEffective().filter(x=>x.category===category&&x.product===product).map(x=>x.variant))];
  }
  function durations(){
    return allEffective().filter(x=>x.category===category&&x.product===product&&x.variant===variant);
  }
  function selectedRow(){
    return allEffective().find(x=>x.category===category&&x.product===product&&x.variant===variant&&x.duration===duration)||null;
  }
  function itemKey(x){return [x.category,x.product,x.variant,x.duration].join('|')}
  function categoryIcon(c){
    const icons={
      'Streaming Apps':'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/></svg>',
      'Education Apps':'<svg viewBox="0 0 24 24"><path d="m3 10 9-5 9 5-9 5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/></svg>',
      'Editing Apps':'<svg viewBox="0 0 24 24"><path d="m4 20 6-6M14 10l6-6M8 8l8 8M5 5l14 14"/></svg>',
      'Music Apps':'<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
      'Other Apps':'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>'
    };
    return icons[c]||icons['Other Apps'];
  }

  function hideGenericMasterAreas(){
    ['tx-packages','tx-topics','tx-addons'].forEach(id=>{
      const el=document.getElementById(id); if(!el)return;
      const box=el.closest('.form-group')||el.parentElement;
      (box||el).classList.add('seller-template-hidden');
    });
  }

  async function loadSellerProductSettings(){
    sellerSettingsReady=false;
    try{
      const {data,error}=await db.from('seller_product_settings')
        .select('item_key,category,product,variant,duration,price,cost')
        .eq('workspace_id',requireWorkspaceId());
      if(error) throw error;
      sellerSettings=new Map((data||[]).map(x=>[x.item_key,x]));
      sellerSettingsReady=true;
    }catch(err){
      console.warn('Seller product settings unavailable:',err?.message||err);
      sellerSettings=new Map();
    }
    renderProducts();
    renderVariants();
    renderDurations();
    renderCart();
    installSellerSettings();
    renderSellerSettingsProducts();
  }

  async function loadSellerCustomerMeta(){
    try{
      const {data,error}=await db.from('customers')
        .select('id,device,admin_fh,warranty')
        .eq('workspace_id',requireWorkspaceId());
      if(error) throw error;
      sellerCustomerMeta=new Map((data||[]).map(x=>[String(x.id),x]));
      decorateCustomerDatabase();
    }catch(err){
      console.warn('Seller customer metadata unavailable:',err?.message||err);
    }
  }

  function renderCategories(){
    const box=document.getElementById('seller-category-grid'); if(!box)return;
    box.innerHTML=CATEGORIES.map(c=>`<button type="button" class="seller-category-card ${c===category?'active':''}" data-seller-category="${esc(c)}"><span>${categoryIcon(c)}</span><strong>${esc(c)}</strong></button>`).join('');
  }
  function renderProducts(){
    const box=document.getElementById('seller-product-grid'); if(!box)return;
    const list=products();
    if(!list.length){
      box.innerHTML=`<div class="seller-product-empty">${searchQuery?'Produk tidak ditemukan.':'Pilih kategori dulu untuk menampilkan produk.'}</div>`;
      renderCategories();
      return;
    }
    box.innerHTML=list.map(p=>`<button type="button" class="seller-product-card ${p.product===product?'active':''}" data-seller-product="${esc(p.product)}" data-seller-product-category="${esc(p.category)}"><img src="${ICON_BASE+slug(p.product)+'.svg'}" alt=""><span>${esc(pretty(p.product))}</span>${searchQuery?`<small>${esc(p.category)}</small>`:''}</button>`).join('');
    renderCategories();
  }
  function renderVariants(){
    const sec=document.getElementById('seller-variant-section'),box=document.getElementById('seller-variant-grid');
    if(!sec||!box)return;
    const list=product?variants():[];
    sec.hidden=!list.length;
    if(!list.length){variant='';duration='';renderDurations();return;}
    if(!variant||!list.includes(variant))variant='';
    box.innerHTML=list.map(v=>`<button type="button" class="seller-choice ${v===variant?'active':''}" data-seller-variant="${esc(v)}">${esc(pretty(v))}</button>`).join('');
    renderDurations();
  }
  function renderDurations(){
    const sec=document.getElementById('seller-duration-section'),box=document.getElementById('seller-duration-grid');
    if(!sec||!box)return;
    const list=variant?durations():[];
    sec.hidden=!list.length;
    const labels=list.map(x=>x.duration);
    if(!duration||!labels.includes(duration))duration='';
    box.innerHTML=list.map(x=>`<button type="button" class="seller-choice ${x.duration===duration?'active':''}" data-seller-duration="${esc(x.duration)}">${esc(pretty(x.duration))}</button>`).join('');
    renderSelection();
  }
  function renderSelection(){
    const r=selectedRow(),box=document.getElementById('seller-selection'),price=document.getElementById('seller-selected-price'),meta=document.getElementById('seller-selected-meta'),add=document.getElementById('seller-add-order');
    if(box)box.hidden=!r;
    if(price)price.textContent=r?(Number(r.price)>0?rupiahLocal(r.price):'Belum diatur'):'—';
    if(meta)meta.textContent=r?`${pretty(r.product)} · ${pretty(r.variant)} · ${pretty(r.duration)}`:'Pilih produk, varian, dan durasi';
    if(add){add.disabled=!r||Number(r.price)<=0;add.textContent=r&&Number(r.price)<=0?'Atur harga di Settings':'+ Tambah ke Pesanan'}
  }
  function renderCart(){
    const list=document.getElementById('seller-cart-list'),count=document.getElementById('seller-cart-count'),total=document.getElementById('seller-cart-total'),empty=document.getElementById('seller-cart-empty');
    if(!list)return;
    const qty=cart.reduce((s,x)=>s+x.qty,0),subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
    let sum=subtotal;
    try{const a=getPriceAdjustment(subtotal);sum=Math.max(0,subtotal+Number(a.amount||0));}catch(_e){}
    const tipRaw=String(document.getElementById('tx-tip')?.value||'').trim(),tip=tipRaw===''?0:Number(tipRaw);
    if(Number.isFinite(tip)&&tip>=0)sum+=tip;
    const txTotal=document.getElementById('tx-total'); if(txTotal)txTotal.textContent=rupiahLocal(sum);
    if(count)count.textContent=`${qty} item${qty===1?'':'s'}`;
    if(total)total.textContent=rupiahLocal(sum);
    if(empty)empty.hidden=cart.length>0;
    list.innerHTML=cart.map((x,i)=>`<div class="seller-cart-item"><img src="${ICON_BASE+slug(x.product)+'.svg'}" alt=""><div class="seller-cart-copy"><strong>${esc(pretty(x.product))}</strong><small>${esc(pretty(x.variant))} · ${esc(pretty(x.duration))}</small></div><div class="seller-cart-qty"><button type="button" data-seller-minus="${i}">−</button><span>${x.qty}</span><button type="button" data-seller-plus="${i}">+</button></div><strong class="seller-cart-subtotal">${rupiahLocal(x.price*x.qty)}</strong><button class="seller-cart-remove" type="button" data-seller-remove="${i}" aria-label="Hapus">×</button></div>`).join('');
    const save=document.getElementById('seller-save-order'); if(save)save.disabled=!cart.length;
    renderSellerPaymentPreview();
  }
  function addSelected(){
    const r=selectedRow(); if(!r)return;
    const item={category:r.category,product:r.product,variant:r.variant,duration:r.duration,price:Number(r.price),cost:Number(r.cost||0),qty:1,seller_key:rowKey(r)};
    const k=itemKey(item),found=cart.find(x=>itemKey(x)===k);
    if(found)found.qty+=1; else cart.push(item);
    renderCart();
    // A cart item is now the source of truth. Clear the browsing state so the form
    // returns to a clean category/product view without touching items already added.
    clearSellerBrowseSelection();
    try{showToast(`${pretty(r.product)} ditambahkan ke pesanan.`)}catch(_e){}
  }

  function extraValue(id){return document.getElementById(id)?.value.trim()||null}
  function buildSellerOrder(){
    if(!cart.length)throw new Error('Pilih minimal 1 paket.');
    const customer=document.getElementById('tx-customer')?.value.trim();
    if(!customer)throw new Error('Nama customer wajib diisi.');
    const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
    let adjustment={type:'none',mode:'nominal',value:0,amount:0};
    try{adjustment=getPriceAdjustment(subtotal)}catch(_e){}
    const tipInput=document.getElementById('tx-tip'),tipRaw=String(tipInput?.value||'').trim(),tip=tipRaw===''?0:Number(tipRaw);
    if(tipRaw!==''&&(!Number.isFinite(tip)||tip<500||tip>10000000))throw new Error('Tip harus di antara Rp500 sampai Rp10.000.000.');
    const total=Math.max(0,subtotal+Number(adjustment.amount||0))+tip;
    const paidRaw=String(document.getElementById('seller-payment-received')?.value||'').trim();
    const paid=paidRaw===''?total:Number(paidRaw);
    if(paidRaw!==''&&(!Number.isFinite(paid)||paid<0||paid>total))throw new Error('Nominal dibayar harus di antara Rp0 dan total transaksi.');
    const items=cart.map((x,i)=>({
      id:`seller-${slug(x.product)}-${i+1}`,code:x.product,
      name:`${pretty(x.product)} · ${pretty(x.variant)} · ${pretty(x.duration)}`,
      seller_key:x.seller_key,category:x.category,product:x.product,variant:x.variant,duration:x.duration,
      qty:x.qty,unit_price:x.price,subtotal:x.price*x.qty,cost_price:x.cost,cost_subtotal:x.cost*x.qty,
      ...(i===0?{seller_payment_received:paid,seller_payment_total:total,seller_order_status:'new'}:{}),
      profit_share_mode:'percentage',manual_profit_split:[]
    }));
    const customerId=document.getElementById('tx-customer-id')?.value||null;
    return {
      transaction_date:document.getElementById('tx-date')?.value,
      [SELLER_LEGACY_FIELDS.startedAt]:new Date().toISOString(),[SELLER_LEGACY_FIELDS.status]:'on_progress',
      shift_id:(typeof currentShift!=='undefined'&&currentShift?.id)?currentShift.id:null,
      customer_name:customer,customer_id:customerId,
      platform:document.getElementById('tx-platform')?.value||'Other',
      social_name:document.getElementById('tx-social-name')?.value.trim()||null,
      whatsapp:document.getElementById('tx-whatsapp')?.value.trim()||null,
      device:extraValue('seller-device'),admin_fh:extraValue('seller-admin-fh'),warranty:extraValue('seller-warranty'),
      package_id:null,package_code:'SELLER_APP',package_price:subtotal,package_qty:cart.reduce((s,x)=>s+x.qty,0),
      topic_id:null,topic_name:'Seller App Premium',addon_id:null,addon_code:null,addon_price:0,addon_qty:0,
      order_items:items,order_topics:[{id:'seller-app-premium',name:'Seller App Premium'}],order_addons:[],
      price_adjustment_type:adjustment.type,price_adjustment_mode:adjustment.mode,price_adjustment_value:adjustment.value,price_adjustment_amount:adjustment.amount,
      tip_amount:tip,total_price:total,
      payment_method:document.getElementById('tx-payment')?.value||'',
      notes:document.getElementById('tx-notes')?.value.trim()||null
    };
  }

  function interceptSubmit(e){
    if(!mounted||!document.getElementById('seller-app-premium-template'))return;
    e.preventDefault();e.stopImmediatePropagation();
    try{
      pendingTransactionPayload=buildSellerOrder();
      const saveBtn=document.getElementById('confirm-save');
      if(saveBtn){saveBtn.style.display='';saveBtn.disabled=false;saveBtn.textContent='✓ Simpan Transaksi'}
      showReceiptPreview(pendingTransactionPayload);
    }catch(err){
      try{showToast(err.message||'Gagal menyiapkan transaksi.',true)}catch(_e){alert(err.message)}
    }
  }

  function clearSellerBrowseSelection(){
    category='';product='';variant='';duration='';searchQuery='';
    const q=document.getElementById('seller-product-search');if(q)q.value='';
    renderCategories();renderProducts();renderVariants();renderDurations();renderSelection();
  }
  function resetSellerChoiceField(id){
    const el=document.getElementById(id);if(!el)return;
    el.value='';
    try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_e){}
  }
  function ensureSellerEmptyPaymentOption(){
    const payment=document.getElementById('tx-payment');if(!payment)return;
    if(!payment.querySelector('option[value=""]')){
      const opt=document.createElement('option');opt.value='';opt.textContent='-- Pilih Metode --';payment.insertBefore(opt,payment.firstChild);
    }
  }
  function resetSellerState(){
    clearSellerBrowseSelection();cart=[];
    ['seller-device','seller-admin-fh','seller-warranty','seller-payment-received'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
    ensureSellerEmptyPaymentOption();
    resetSellerChoiceField('tx-platform');
    resetSellerChoiceField('tx-payment');
    renderCart();
  }

  function installExtraFields(){
    if(document.getElementById('seller-extra-details'))return;
    const host=document.getElementById('seller-app-premium-template');if(!host)return;
    const details=document.createElement('details');
    details.id='seller-extra-details';details.className='seller-extra-details';
    details.innerHTML=`<summary><span>Detail Tambahan (Opsional)</span><small>Device, Admin FH, Garansi</small></summary><div class="seller-extra-grid"><div class="form-group"><label class="label">Device</label><input id="seller-device" class="input" placeholder="contoh: iPhone / Android / TV"></div><div class="form-group"><label class="label">Admin FH</label><input id="seller-admin-fh" class="input" placeholder="Nama admin FH"></div><div class="form-group"><label class="label">Garansi</label><input id="seller-warranty" class="input" placeholder="contoh: 30 hari / 1 bulan"></div></div>`;
    host.appendChild(details);
  }

  function installSellerPaymentField(){
    if(document.getElementById('seller-payment-panel'))return;
    const extra=document.getElementById('seller-extra-details');if(!extra)return;
    const panel=document.createElement('section');panel.id='seller-payment-panel';panel.className='seller-payment-panel';
    panel.innerHTML=`<div class="seller-payment-head"><div><strong>Pembayaran Customer</strong><small>Opsional untuk DP / pembayaran sebagian. Kosong = dianggap lunas penuh.</small></div></div><div class="seller-payment-grid"><label><span>Nominal Dibayar</span><input id="seller-payment-received" type="number" min="0" step="500" class="input" placeholder="Kosong = lunas penuh"></label><div class="seller-payment-preview"><span>Sisa Piutang</span><strong id="seller-payment-outstanding">Rp0</strong></div></div>`;
    extra.insertAdjacentElement('afterend',panel);
    document.getElementById('seller-payment-received')?.addEventListener('input',renderSellerPaymentPreview);
  }
  function sellerCurrentOrderTotal(){
    const subtotal=cart.reduce((sum,x)=>sum+Number(x.price||0)*Number(x.qty||1),0);
    let adjustment={amount:0};try{adjustment=getPriceAdjustment(subtotal)}catch(_e){}
    const tipRaw=String(document.getElementById('tx-tip')?.value||'').trim(),tip=tipRaw===''?0:Number(tipRaw);
    return Math.max(0,subtotal+Number(adjustment.amount||0))+(Number.isFinite(tip)&&tip>=0?tip:0);
  }
  function renderSellerPaymentPreview(){
    const out=document.getElementById('seller-payment-outstanding');if(!out)return;
    const total=sellerCurrentOrderTotal(),raw=String(document.getElementById('seller-payment-received')?.value||'').trim();
    const paid=raw===''?total:Math.max(0,Math.min(total,Number(raw)||0));
    out.textContent=rupiahLocal(Math.max(0,total-paid));
  }

  function installCompactActions(form,cartBox){
    if(document.getElementById('seller-order-actions'))return;
    const originalSubmit=form.querySelector('button[type="submit"],input[type="submit"]');
    if(originalSubmit)originalSubmit.classList.add('seller-original-submit-hidden');
    form.querySelectorAll('button[type="reset"],input[type="reset"],button[onclick*="resetTxForm"]').forEach(x=>x.classList.add('seller-original-submit-hidden'));
    // Defensive fallback for the legacy core Reset button which historically used type="button".
    form.querySelectorAll('button[type="button"]').forEach(x=>{
      if(x.id==='seller-reset-order')return;
      if((x.textContent||'').trim().toLowerCase()==='reset')x.classList.add('seller-original-submit-hidden');
    });
    const actions=document.createElement('div');actions.id='seller-order-actions';actions.className='seller-order-actions';
    actions.innerHTML=`<button type="button" class="seller-reset-btn" id="seller-reset-order">↻ Reset</button><button type="button" class="seller-save-btn" id="seller-save-order">Simpan Penjualan</button>`;
    cartBox.insertAdjacentElement('afterend',actions);
    document.getElementById('seller-reset-order').addEventListener('click',()=>{try{resetTxForm()}catch(_e){document.getElementById('tx-form')?.reset();resetSellerState()}});
    document.getElementById('seller-save-order').addEventListener('click',()=>{if(!cart.length)return;form.requestSubmit();});
  }

  function installSellerOrderLayout(form){
    // Seller history belongs to Dashboard only. Orders stays a single full-width work area.
    const orderCard=form.closest('.card');
    const historyCard=document.getElementById('transaction-history-card');
    if(historyCard) historyCard.classList.add('seller-core-history-hidden');
    if(orderCard){
      orderCard.classList.add('seller-orders-card-full');
      orderCard.style.maxWidth='none';
      orderCard.style.width='100%';
    }
  }

  function installSellerDashboardHistory(){
    const dash=document.getElementById('dashboard');
    if(!dash)return null;
    let card=document.getElementById('seller-dashboard-history-card');
    if(card)return card;
    card=document.createElement('section');
    card.id='seller-dashboard-history-card';
    card.className='card seller-dashboard-history-card';
    const today=sellerLocalISO(new Date());
    if(!sellerHistoryCustomFrom)sellerHistoryCustomFrom=today;
    if(!sellerHistoryCustomTo)sellerHistoryCustomTo=today;
    card.innerHTML=`<div class="seller-dashboard-history-head"><div><div class="card-title">Riwayat Transaksi</div></div><div class="seller-dashboard-history-tools"><div class="seller-history-filter"><select id="seller-history-date-filter" aria-label="Filter tanggal riwayat transaksi"><option value="today">Hari Ini</option><option value="yesterday">Kemarin</option><option value="week">Minggu Ini</option><option value="month">Bulan Ini</option><option value="custom">Kustom</option></select><div id="seller-history-custom-range" class="seller-history-custom-range" hidden><input id="seller-history-custom-from" type="date" value="${esc(sellerHistoryCustomFrom)}"><span>s/d</span><input id="seller-history-custom-to" type="date" value="${esc(sellerHistoryCustomTo)}"></div></div><button type="button" id="seller-history-toggle" class="seller-history-toggle">Lihat Semua</button></div></div><div id="seller-history-list" class="seller-history-list"></div>`;
    dash.appendChild(card);
    const filter=card.querySelector('#seller-history-date-filter');
    if(filter){filter.value=sellerHistoryDateFilter;filter.addEventListener('change',()=>{sellerHistoryDateFilter=filter.value||'today';historyExpanded=false;syncSellerHistoryCustomRange();renderSellerHistory()})}
    card.querySelector('#seller-history-custom-from')?.addEventListener('change',e=>{sellerHistoryCustomFrom=e.target.value||'';historyExpanded=false;renderSellerHistory()});
    card.querySelector('#seller-history-custom-to')?.addEventListener('change',e=>{sellerHistoryCustomTo=e.target.value||'';historyExpanded=false;renderSellerHistory()});
    card.querySelector('#seller-history-toggle')?.addEventListener('click',()=>{historyExpanded=!historyExpanded;renderSellerHistory()});
    syncSellerHistoryCustomRange();
    card.addEventListener('click',e=>{
      const r=e.target.closest('[data-seller-history-receipt]');if(r){e.stopPropagation();openSavedReceipt(r.dataset.sellerHistoryReceipt);return}
      const d=e.target.closest('[data-seller-history-delete]');if(d){e.stopPropagation();deleteCancelledTransaction(d.dataset.sellerHistoryDelete,d.dataset.sellerHistoryName,d.dataset.sellerHistoryCustomer);return}
      const st=e.target.closest('[data-seller-order-status]');if(st){e.stopPropagation();setSellerOrderStatus(st.dataset.sellerTransactionId,st.dataset.sellerOrderStatus,st);return}
      const pay=e.target.closest('[data-seller-settle-payment]');if(pay){e.stopPropagation();settleSellerPayment(pay.dataset.sellerSettlePayment,pay);return}
      const row=e.target.closest('.seller-history-card');if(row){row.classList.toggle('is-expanded')}
    });
    return card;
  }

  function sellerLocalISO(d){
    const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }
  function sellerDateOffset(days){const d=new Date();d.setDate(d.getDate()+days);return sellerLocalISO(d)}
  function sellerHistoryBounds(){
    const now=new Date(),today=sellerLocalISO(now);
    if(sellerHistoryDateFilter==='today')return {from:today,to:today};
    if(sellerHistoryDateFilter==='yesterday'){const y=sellerDateOffset(-1);return {from:y,to:y}}
    if(sellerHistoryDateFilter==='week'){const d=new Date(now),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return {from:sellerLocalISO(d),to:today}}
    if(sellerHistoryDateFilter==='month'){return {from:sellerLocalISO(new Date(now.getFullYear(),now.getMonth(),1)),to:today}}
    if(sellerHistoryDateFilter==='custom')return {from:sellerHistoryCustomFrom||today,to:sellerHistoryCustomTo||sellerHistoryCustomFrom||today};
    return {from:null,to:null};
  }
  function sellerHistoryMatches(t){
    const day=txLocalDay(t),b=sellerHistoryBounds();if(!day)return false;
    if(b.from&&day<b.from)return false;if(b.to&&day>b.to)return false;return true;
  }
  function sellerHistoryDateTime(t){
    const day=txLocalDay(t);let dateText='-';
    if(day){const d=new Date(`${day}T00:00:00`);if(!Number.isNaN(d.getTime()))dateText=new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(d)}
    return `${dateText} • ${txTime(t)}`;
  }
  function syncSellerHistoryCustomRange(){
    const box=document.getElementById('seller-history-custom-range');if(box)box.hidden=sellerHistoryDateFilter!=='custom';
  }

  function txTime(t){
    const raw=sellerStartedAt(t);
    if(raw){const d=new Date(raw);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace('.',':')}
    return '-';
  }
  function txStamp(t){
    const raw=sellerStartedAt(t)||`${t.transaction_date||'1970-01-01'}T00:00:00`;
    const d=new Date(raw);return Number.isNaN(d.getTime())?0:d.getTime();
  }
  function historyPackageText(t){
    const items=Array.isArray(t.order_items)?t.order_items:[];
    if(items.length)return items.map(x=>`${pretty(x.product||x.package_name||'Paket')} · ${pretty(x.variant||'')} · ${pretty(x.duration||'')} × ${Number(x.qty||1)}`).join(' | ');
    return String(t.package_name||t.package_code||'-');
  }
  function historyQty(t){
    const items=Array.isArray(t.order_items)?t.order_items:[];
    return items.length?items.reduce((n,x)=>n+Number(x.qty||1),0):Number(t.qty||1);
  }
  function sellerDateAtMidnight(day){
    const d=new Date(`${day}T00:00:00`);
    return Number.isNaN(d.getTime())?null:d;
  }
  function sellerDurationParts(raw){
    const text=String(raw||'').toLowerCase();
    const m=text.match(/(\d+(?:[.,]\d+)?)\s*(hari|day|days|minggu|week|weeks|bulan|month|months|tahun|year|years)\b/i);
    if(!m)return null;
    return {value:Number(String(m[1]).replace(',','.')),unit:m[2].toLowerCase()};
  }
  function sellerExpiryDate(t,item){
    const start=sellerDateAtMidnight(txLocalDay(t));
    const part=sellerDurationParts(item?.duration);
    if(!start||!part||!Number.isFinite(part.value)||part.value<=0)return null;
    const d=new Date(start);
    const n=part.value;
    if(['hari','day','days'].includes(part.unit))d.setDate(d.getDate()+n);
    else if(['minggu','week','weeks'].includes(part.unit))d.setDate(d.getDate()+(n*7));
    else if(['bulan','month','months'].includes(part.unit)){
      if(Number.isInteger(n))d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+Math.round(n*30));
    }else if(['tahun','year','years'].includes(part.unit)){
      if(Number.isInteger(n))d.setFullYear(d.getFullYear()+n);else d.setDate(d.getDate()+Math.round(n*365));
    }
    return d;
  }
  function sellerDaysUntil(expiry){
    const today=sellerDateAtMidnight(sellerLocalISO(new Date()));
    if(!today||!expiry)return null;
    return Math.round((expiry.getTime()-today.getTime())/86400000);
  }
  function sellerExpiryBadge(days){
    if(days===null)return null;
    if(days<0)return {label:'Expired',tone:'expired'};
    if(days===0)return {label:'Expired hari ini',tone:'urgent'};
    if(days<=3)return {label:`H-${days}`,tone:'urgent'};
    if(days<=7)return {label:`H-${days}`,tone:'soon'};
    return {label:'Aktif',tone:'active'};
  }
  function sellerExpiryEntriesForTx(t){
    const items=Array.isArray(t?.order_items)?t.order_items:[];
    return items.map((item,index)=>{
      const expiry=sellerExpiryDate(t,item);if(!expiry)return null;
      const days=sellerDaysUntil(expiry);
      return {tx:t,item,index,expiry,days,badge:sellerExpiryBadge(days)};
    }).filter(Boolean);
  }
  function sellerNearestExpiry(t){
    const entries=sellerExpiryEntriesForTx(t).sort((a,b)=>a.expiry-b.expiry);
    return entries[0]||null;
  }
  function sellerExpiryDateText(d){
    return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  }
  function installSellerDashboardAlertRow(){
    const dash=document.getElementById('dashboard');if(!dash)return null;
    let row=document.getElementById('seller-dashboard-alert-row');
    if(!row){
      row=document.createElement('div');row.id='seller-dashboard-alert-row';row.className='seller-dashboard-alert-row';
      const history=document.getElementById('seller-dashboard-history-card');
      if(history)history.insertAdjacentElement('beforebegin',row);else dash.appendChild(row);
    }
    return row;
  }
  function installSellerExpiryTracker(){
    const dash=document.getElementById('dashboard');if(!dash)return null;
    let card=document.getElementById('seller-expiry-card');if(card)return card;
    card=document.createElement('section');card.id='seller-expiry-card';card.className='card seller-expiry-card';
    card.innerHTML=`<div class="seller-expiry-head"><div><div class="card-title">Akan Expired</div><div class="muted">Dihitung otomatis dari tanggal transaksi + durasi paket.</div></div><span class="seller-expiry-window">14 hari</span></div><div id="seller-expiry-list" class="seller-expiry-list"></div>`;
    const row=installSellerDashboardAlertRow();
    if(row)row.appendChild(card);else dash.appendChild(card);
    return card;
  }
  function renderSellerExpiryTracker(){
    if(!mounted)return;
    const card=installSellerExpiryTracker();if(!card)return;
    const host=document.getElementById('seller-expiry-list');if(!host)return;
    const txs=(historyTransactions||[]).filter(isSellerTx);
    const entries=txs.flatMap(sellerExpiryEntriesForTx)
      .filter(x=>x.days>=-7&&x.days<=14)
      .sort((a,b)=>a.expiry-b.expiry||txStamp(b.tx)-txStamp(a.tx))
      .slice(0,8);
    host.innerHTML=entries.length?entries.map(x=>{
      const item=x.item||{},badge=x.badge||sellerExpiryBadge(x.days);
      const meta=[pretty(item.product||item.package_name||'Paket'),pretty(item.variant||''),pretty(item.duration||'')].filter(Boolean).join(' · ');
      return `<div class="seller-expiry-row"><div class="seller-expiry-copy"><strong>${esc(x.tx.customer_name||'-')}</strong><small>${esc(meta)}</small></div><div class="seller-expiry-date"><span>${esc(sellerExpiryDateText(x.expiry))}</span><b class="seller-expiry-badge is-${esc(badge.tone)}">${esc(badge.label)}</b></div></div>`;
    }).join(''):'<div class="seller-expiry-empty">Tidak ada akun yang akan expired dalam 14 hari.</div>';
  }

  function sellerPaymentMeta(t){
    const total=Math.max(0,Number(t?.total_price||0));
    const items=Array.isArray(t?.order_items)?t.order_items:[];
    const meta=items.find(x=>x&&Object.prototype.hasOwnProperty.call(x,'seller_payment_received'))||null;
    const paid=meta?Math.max(0,Math.min(total,Number(meta.seller_payment_received||0))):total;
    const outstanding=Math.max(0,total-paid);
    return {total,paid,outstanding,isPartial:outstanding>0};
  }
  async function settleSellerPayment(transactionId,el){
    const tx=(historyTransactions||[]).find(t=>String(t.id)===String(transactionId))||(transactions||[]).find(t=>String(t.id)===String(transactionId));
    if(!tx)return;
    const current=sellerPaymentMeta(tx);if(!current.outstanding)return;
    if(el)el.disabled=true;
    try{
      const items=(Array.isArray(tx.order_items)?tx.order_items:[]).map(x=>({...x}));
      if(!items.length)throw new Error('Detail item transaksi tidak tersedia.');
      items[0].seller_payment_received=current.total;items[0].seller_payment_total=current.total;
      const {error}=await db.from('transactions').update({order_items:items}).eq('workspace_id',requireWorkspaceId()).eq('id',transactionId);
      if(error)throw error;
      [transactions,historyTransactions].forEach(list=>{const row=Array.isArray(list)?list.find(t=>String(t.id)===String(transactionId)):null;if(row)row.order_items=items});
      renderSellerHistory();renderSellerOutstandingTracker();
      try{showToast('Piutang ditandai lunas.')}catch(_e){}
    }catch(err){try{showToast('Gagal memperbarui pembayaran: '+(err?.message||err),true)}catch(_e){};if(el)el.disabled=false}
  }
  function installSellerOutstandingTracker(){
    const dash=document.getElementById('dashboard');if(!dash)return null;
    let card=document.getElementById('seller-outstanding-card');if(card)return card;
    card=document.createElement('section');card.id='seller-outstanding-card';card.className='card seller-outstanding-card';
    card.innerHTML=`<div class="seller-outstanding-head"><div><div class="card-title">Piutang Aktif</div><div class="muted">Transaksi Seller App Premium yang belum dibayar penuh.</div></div><strong id="seller-outstanding-total">Rp0</strong></div><div id="seller-outstanding-list" class="seller-outstanding-list"></div>`;
    const row=installSellerDashboardAlertRow();
    if(row){
      const expiry=document.getElementById('seller-expiry-card');
      if(expiry&&expiry.parentElement!==row)row.appendChild(expiry);
      row.appendChild(card);
    }else dash.appendChild(card);
    card.addEventListener('click',e=>{const b=e.target.closest('[data-seller-settle-payment]');if(b){e.stopPropagation();settleSellerPayment(b.dataset.sellerSettlePayment,b)}});
    return card;
  }
  function renderSellerOutstandingTracker(){
    if(!mounted)return;
    const card=installSellerOutstandingTracker();if(!card)return;
    const host=document.getElementById('seller-outstanding-list'),totalEl=document.getElementById('seller-outstanding-total');if(!host||!totalEl)return;
    const rows=(historyTransactions||[]).filter(isSellerTx).map(tx=>({tx,payment:sellerPaymentMeta(tx)})).filter(x=>x.payment.outstanding>0).sort((a,b)=>txStamp(b.tx)-txStamp(a.tx));
    totalEl.textContent=rupiahLocal(rows.reduce((sum,x)=>sum+x.payment.outstanding,0));
    host.innerHTML=rows.length?rows.slice(0,8).map(({tx,payment})=>`<div class="seller-outstanding-row"><div class="seller-outstanding-copy"><strong>${esc(tx.customer_name||'-')}</strong><small>${esc(historyPackageText(tx))}</small></div><div class="seller-outstanding-money"><span>Dibayar ${rupiahLocal(payment.paid)}</span><strong>Sisa ${rupiahLocal(payment.outstanding)}</strong></div><button type="button" data-seller-settle-payment="${esc(tx.id)}">Tandai Lunas</button></div>`).join(''):'<div class="seller-outstanding-empty">Tidak ada piutang aktif.</div>';
  }

  function sellerOrderStatus(value,tx){
    const meta=Array.isArray(tx?.order_items)&&tx.order_items.length?String(tx.order_items[0]?.seller_order_status||'').toLowerCase():'';
    const raw=meta||String(value||'').toLowerCase();
    if(raw==='done'||raw==='completed'||raw==='selesai')return {key:'done',label:'Selesai'};
    if(raw==='on_progress'||raw==='processing'||raw==='diproses')return {key:'progress',label:'Diproses'};
    if(raw==='new'||raw==='baru')return {key:'new',label:'Baru'};
    return {key:'progress',label:'Diproses'};
  }
  async function setSellerOrderStatus(transactionId,next,el){
    if(!transactionId||!['new','on_progress','done'].includes(next))return;
    const controls=el?.closest('.seller-order-status-control');
    if(controls)controls.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{
      const source=[...(Array.isArray(historyTransactions)?historyTransactions:[]),...(Array.isArray(transactions)?transactions:[])];
      const current=source.find(t=>String(t.id)===String(transactionId));
      const items=(Array.isArray(current?.order_items)?current.order_items:[]).map(x=>({...x}));
      if(items.length)items[0].seller_order_status=next;
      const backendStatus=sellerBackendStatus(next);
      const payload={[SELLER_LEGACY_FIELDS.status]:backendStatus};
      if(items.length)payload.order_items=items;
      const {error}=await db.from('transactions').update(payload).eq('workspace_id',requireWorkspaceId()).eq('id',transactionId);
      if(error)throw error;
      [transactions,historyTransactions].forEach(list=>{
        const tx=Array.isArray(list)?list.find(t=>String(t.id)===String(transactionId)):null;
        if(tx){tx[SELLER_LEGACY_FIELDS.status]=backendStatus;if(items.length)tx.order_items=items.map(x=>({...x}))}
      });
      renderSellerHistory();
      try{if(typeof loadCustomerDirectory==='function')await loadCustomerDirectory()}catch(_e){}
      const status=sellerOrderStatus(next,{order_items:[{seller_order_status:next}]});
      try{showToast(`Status order diubah menjadi ${status.label}.`)}catch(_e){}
    }catch(err){
      try{showToast('Gagal mengubah status order: '+(err?.message||err),true)}catch(_e){}
      if(controls)controls.querySelectorAll('button').forEach(b=>b.disabled=false);
    }
  }

  function renderSellerHistory(){
    if(!mounted)return;
    document.getElementById('transaction-history-card')?.classList.add('seller-core-history-hidden');
    const card=installSellerDashboardHistory();if(!card)return;
    const host=document.getElementById('seller-history-list');if(!host)return;
    const all=(historyTransactions||[]).filter(t=>isSellerTx(t)&&sellerHistoryMatches(t)).slice().sort((a,b)=>txStamp(b)-txStamp(a));
    const limit=historyExpanded?all.length:(window.innerWidth<=900?3:7),rows=all.slice(0,limit);
    host.innerHTML=rows.length?rows.map(t=>{
      const payment=pretty(t.payment_method||t.payment||'-');
      const tip=Number(t.tip||t.tip_amount||0);
      const meta=[t.device&&`Device: ${t.device}`,t.admin_fh&&`Admin FH: ${t.admin_fh}`,t.warranty&&`Garansi: ${t.warranty}`].filter(Boolean).join(' · ');
      const orderStatus=sellerOrderStatus(t?.[SELLER_LEGACY_FIELDS.status],t);
      return `<article class="seller-history-card" data-seller-history-row="${esc(t.id)}"><div class="seller-history-avatar">${esc(String(t.customer_name||'?').trim().charAt(0).toUpperCase()||'?')}</div><div class="seller-history-main"><strong>${esc(t.customer_name||'-')}</strong><small>${esc(sellerHistoryDateTime(t))}</small><span class="seller-order-status-pill is-${esc(orderStatus.key)}">${esc(orderStatus.label)}</span>${(()=>{const ex=sellerNearestExpiry(t);if(!ex)return '';const badge=ex.badge||sellerExpiryBadge(ex.days);return `<span class="seller-history-expiry is-${esc(badge.tone)}">${esc(badge.label)} · ${esc(sellerExpiryDateText(ex.expiry))}</span>`})()}</div><div class="seller-history-actions"><button type="button" class="seller-history-receipt" data-seller-history-receipt="${esc(t.id)}">Struk</button><button type="button" class="seller-history-delete" data-seller-history-delete="${esc(t.id)}" data-seller-history-name="${esc(t.customer_name||'')}" data-seller-history-customer="${esc(t.customer_id||'')}">Hapus</button></div><div class="seller-history-detail"><div><span>Paket</span><strong>${esc(historyPackageText(t))}</strong></div><div><span>Qty</span><strong>${historyQty(t)}</strong></div><div><span>Tip</span><strong>${rupiahLocal(tip)}</strong></div><div><span>Total</span><strong>${rupiahLocal(Number(t.total_price||0))}</strong></div><div><span>Pembayaran</span><strong>${esc(payment)}</strong></div>${(()=>{const pm=sellerPaymentMeta(t);return `<div><span>Dibayar</span><strong>${rupiahLocal(pm.paid)}</strong></div><div><span>Piutang</span><strong>${rupiahLocal(pm.outstanding)}</strong></div>${pm.outstanding>0?`<div><span>Status Bayar</span><strong><button type="button" class="seller-payment-settle-inline" data-seller-settle-payment="${esc(t.id)}">Tandai Lunas</button></strong></div>`:''}`})()}${meta?`<div class="seller-history-detail-wide"><span>Detail</span><strong>${esc(meta)}</strong></div>`:''}<div class="seller-history-detail-wide seller-order-status-row"><span>Status Order</span><div class="seller-order-status-control" role="group" aria-label="Status order ${esc(t.customer_name||'')}"><button type="button" class="${orderStatus.key==='new'?'active':''}" data-seller-transaction-id="${esc(t.id)}" data-seller-order-status="new">Baru</button><button type="button" class="${orderStatus.key==='progress'?'active':''}" data-seller-transaction-id="${esc(t.id)}" data-seller-order-status="on_progress">Diproses</button><button type="button" class="${orderStatus.key==='done'?'active':''}" data-seller-transaction-id="${esc(t.id)}" data-seller-order-status="done">Selesai</button></div></div></div></article>`
    }).join(''):'<div class="seller-history-empty">Belum ada transaksi Seller App Premium.</div>';
    const toggle=document.getElementById('seller-history-toggle');
    if(toggle){toggle.hidden=all.length<=limit&&!historyExpanded;toggle.textContent=historyExpanded?'Tampilkan Ringkas':'Lihat Semua'}
  }

  function txLocalDay(t){
    if(t?.transaction_date)return String(t.transaction_date).slice(0,10);
    const raw=sellerStartedAt(t);if(!raw)return '';
    const d=new Date(raw);if(Number.isNaN(d.getTime()))return '';
    const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }
  function sellerPeriodRows(){
    // `transactions` is already filtered by the core dashboard period (today / 7d / 30d / custom).
    // Use that exact source so Seller KPI always follows the active dashboard filter.
    const source=Array.isArray(transactions)?transactions:[];
    const seen=new Set();
    return source.filter(t=>{
      const key=String(t?.id||`${txStamp(t)}|${t?.customer_name||''}|${t?.total_price||0}`);
      if(seen.has(key))return false;
      seen.add(key);
      return isSellerTx(t);
    });
  }
  function sellerPeriodLabel(kind){
    const period=(typeof activePeriod!=='undefined'?String(activePeriod):'today');
    const suffix=period==='today'?'Hari Ini':period==='7days'?'7 Hari Terakhir':period==='30days'?'30 Hari Terakhir':'Periode Kustom';
    return `${kind} ${suffix}`;
  }
  function sellerProfit(t){
    const costs=(Array.isArray(t.order_items)?t.order_items:[]).reduce((s,x)=>s+Number((x.cost_subtotal ?? (Number(x.cost_price||0)*Number(x.qty||1))) || 0),0);
    return Number(t.total_price||0)-costs;
  }
  function renderSellerDashboardKpis(){
    if(!mounted)return;
    const revenueEl=document.getElementById('kpi-revenue');if(!revenueEl)return;
    const rows=sellerPeriodRows(),revenue=rows.reduce((s,t)=>s+Number(t.total_price||0),0),profit=rows.reduce((s,t)=>s+sellerProfit(t),0);
    const revCard=revenueEl.closest('.kpi');
    if(revCard){
      const label=revCard.querySelector('.kpi-label');if(label)label.textContent=sellerPeriodLabel('Omset');
      revenueEl.textContent=(typeof maskedNominals!=='undefined'&&maskedNominals)?'••••••':rupiahLocal(revenue);
    }
    let card=document.getElementById('seller-kpi-profit-card');
    if(!card&&revCard){
      card=document.createElement('div');card.className='kpi seller-profit-kpi';card.id='seller-kpi-profit-card';
      card.innerHTML=`<div class="kpi-head"><div class="kpi-label">${sellerPeriodLabel('Profit')}</div><button type="button" class="kpi-eye" id="seller-profit-eye" aria-label="Sembunyikan nominal"></button></div><div class="kpi-value" id="seller-kpi-profit">Rp0</div>`;
      revCard.insertAdjacentElement('afterend',card);
      document.getElementById('seller-profit-eye')?.addEventListener('click',()=>{if(typeof toggleKpiVisibility==='function')toggleKpiVisibility();renderSellerDashboardKpis()});
      try{updateKpiEyeButtons()}catch(_e){}
    }
    const profitLabel=card?.querySelector('.kpi-label');if(profitLabel)profitLabel.textContent=sellerPeriodLabel('Profit');
    const val=document.getElementById('seller-kpi-profit');
    if(val)val.textContent=(typeof maskedNominals!=='undefined'&&maskedNominals)?'••••••':rupiahLocal(profit);
  }

  function decorateCustomerDatabase(){
    if(!mounted)return;
    document.querySelectorAll('.customer-db-name-btn').forEach(btn=>{
      const id=String(btn.dataset.customerHistoryId||'');const meta=sellerCustomerMeta.get(id);if(!meta)return;
      const td=btn.closest('td');if(!td)return;
      let line=td.querySelector('.seller-customer-meta');
      if(!line){line=document.createElement('small');line.className='seller-customer-meta';td.appendChild(line)}
      const bits=[];if(meta.device)bits.push('Device: '+meta.device);if(meta.admin_fh)bits.push('Admin FH: '+meta.admin_fh);if(meta.warranty)bits.push('Garansi: '+meta.warranty);
      line.textContent=bits.join(' · ');
      line.hidden=!bits.length;
    });
  }

  function installReceiptExtras(){
    if(typeof showReceiptPreview!=='function'||showReceiptPreview.__sellerWrapped)return;
    const core=showReceiptPreview;
    const wrapped=function(p){
      const result=core.apply(this,arguments);
      if(isSellerTx(p)){
        const content=document.getElementById('receipt-content');
        if(content){
          const status=sellerOrderStatus(p?.[SELLER_LEGACY_FIELDS.status],p);
          Array.from(content.children||[]).forEach(node=>{if(/^Status:/i.test(String(node.textContent||'').trim()))node.innerHTML=`<strong>Status:</strong> ${esc(status.label)}`});
          const bits=[];if(p.device)bits.push(`<div><strong>Device:</strong> ${esc(p.device)}</div>`);if(p.admin_fh)bits.push(`<div><strong>Admin FH:</strong> ${esc(p.admin_fh)}</div>`);if(p.warranty)bits.push(`<div><strong>Garansi:</strong> ${esc(p.warranty)}</div>`);
          const pm=sellerPaymentMeta(p);if(pm.outstanding>0){bits.push(`<div><strong>Dibayar:</strong> ${rupiahLocal(pm.paid)}</div>`);bits.push(`<div><strong>Sisa Piutang:</strong> ${rupiahLocal(pm.outstanding)}</div>`)}
          if(bits.length)content.insertAdjacentHTML('afterbegin',bits.join(''));
        }
      }
      return result;
    };
    wrapped.__sellerWrapped=true;showReceiptPreview=wrapped;
  }

  async function saveSellerSetting(baseRow,price,cost){
    if(!sellerSettingsReady)throw new Error('Migration Seller App Premium belum diterapkan / belum bisa diakses.');
    if(!isWorkspaceAdmin())throw new Error('Hanya Owner/Admin yang bisa mengubah Produk.');
    const row={...baseRow,price:Math.max(0,Number(price||0)),cost:Math.max(0,Number(cost||0))};
    const payload={workspace_id:requireWorkspaceId(),item_key:rowKey(baseRow),category:baseRow.category,product:baseRow.product,variant:baseRow.variant,duration:baseRow.duration,price:row.price,cost:row.cost,updated_at:new Date().toISOString()};
    const {error}=await db.from('seller_product_settings').upsert(payload,{onConflict:'workspace_id,item_key'});
    if(error)throw error;
    sellerSettings.set(payload.item_key,payload);
    renderProducts();renderVariants();renderDurations();renderSelection();
  }

  function sellerSettingsRows(){
    const q=settingsSearch.trim().toLowerCase();
    return allEffective().filter(x=>x.category===settingsCategory && (!q||pretty(x.product).toLowerCase().includes(q)||pretty(x.variant).toLowerCase().includes(q)||pretty(x.duration).toLowerCase().includes(q)));
  }
  function renderSellerSettingsProducts(){
    const host=document.getElementById('seller-settings-products-list');if(!host)return;
    const rows=sellerSettingsRows(),groups=new Map();
    rows.forEach(r=>{if(!groups.has(r.product))groups.set(r.product,[]);groups.get(r.product).push(r)});
    if(!groups.size){host.innerHTML='<div class="seller-settings-empty">Produk tidak ditemukan.</div>';return}
    host.innerHTML=[...groups.entries()].map(([prod,list])=>`<details class="seller-settings-product-group" ${settingsSearch?'open':''}><summary><span><img src="${ICON_BASE+slug(prod)+'.svg'}" alt=""><strong>${esc(pretty(prod))}</strong></span><small>${list.length} pilihan</small></summary><div class="seller-settings-option-list">${list.map(base=>{const r=effective(base);return `<div class="seller-settings-option" data-seller-setting-key="${esc(rowKey(base))}"><div class="seller-settings-copy"><strong>${esc(pretty(base.variant))}</strong><small>${esc(pretty(base.duration))}</small></div><label>Harga<input type="number" min="0" step="500" class="seller-setting-price" value="${Number(r.price||0)>0?Number(r.price):''}"></label><label>Modal<input type="number" min="0" step="500" class="seller-setting-cost" value="${Number(r.cost||0)}"></label><div class="seller-setting-profit"><small>Profit/unit</small><strong>${rupiahLocal(Math.max(0,Number(r.price||0)-Number(r.cost||0)))}</strong></div><button type="button" class="seller-setting-save">Simpan</button></div>`}).join('')}</div></details>`).join('');
  }

  async function addCustomSellerProduct(form){
    if(!sellerSettingsReady)throw new Error('Migration Seller App Premium belum diterapkan / belum bisa diakses.');
    if(!isWorkspaceAdmin())throw new Error('Hanya Owner/Admin yang bisa menambah Produk.');
    const fd=new FormData(form);
    const category=String(fd.get('category')||'').trim();
    const product=String(fd.get('product')||'').trim().toUpperCase();
    const variant=String(fd.get('variant')||'').trim().toUpperCase();
    const duration=String(fd.get('duration')||'').trim();
    const price=Math.max(0,Number(fd.get('price')||0));
    const cost=Math.max(0,Number(fd.get('cost')||0));
    if(!CATEGORIES.includes(category))throw new Error('Pilih kategori produk.');
    if(!product)throw new Error('Nama produk wajib diisi.');
    if(!variant)throw new Error('Plan / varian wajib diisi.');
    if(!duration)throw new Error('Durasi wajib diisi.');
    const customNames=sellerCustomProductNames();
    if(sellerPlan()==='basic'&&!customNames.has(product)&&customNames.size>=BASIC_CUSTOM_PRODUCT_LIMIT){
      throw new Error(`Paket Basic maksimal ${BASIC_CUSTOM_PRODUCT_LIMIT} produk custom. Upgrade ke Plus untuk menambah produk custom tanpa batas.`);
    }
    const base={category,product,variant,duration,price,cost};
    const key=rowKey(base);
    if(allEffective().some(x=>rowKey(x)===key))throw new Error('Produk dengan varian dan durasi tersebut sudah ada.');
    const payload={workspace_id:requireWorkspaceId(),item_key:key,category,product,variant,duration,price,cost,updated_at:new Date().toISOString()};
    const {error}=await db.from('seller_product_settings').upsert(payload,{onConflict:'workspace_id,item_key'});
    if(error)throw error;
    sellerSettings.set(key,payload);
    updateSellerCustomLimitUI();
    settingsCategory=category;
    settingsSearch='';
    renderCategories();renderProducts();renderVariants();renderDurations();renderSelection();renderSellerSettingsProducts();
    return payload;
  }

  function openSellerProductCreator(){
    const modal=document.getElementById('seller-add-product-modal');if(!modal)return;
    const form=modal.querySelector('form');if(form)form.reset();
    const cat=form?.querySelector('[name="category"]');if(cat)cat.value=settingsCategory||CATEGORIES[0]||'';
    modal.hidden=false;
    setTimeout(()=>modal.querySelector('[name="product"]')?.focus(),30);
  }
  function closeSellerProductCreator(){const modal=document.getElementById('seller-add-product-modal');if(modal)modal.hidden=true}

  function installSellerSettings(){
    const panel=document.querySelector('[data-settings-panel="packages"]');if(!panel)return;
    const select=document.getElementById('settings-category-select');
    const opt=select?.querySelector('option[value="packages"]');if(opt)opt.textContent='Produk';
    document.querySelectorAll('.saas-settings-submenu-btn[data-settings-category="packages"]').forEach(b=>b.textContent='Produk');
    const genericCard=panel.querySelector('.settings-master-card');
    if(genericCard)genericCard.classList.add('seller-template-hidden');
    let seller=document.getElementById('seller-settings-products');
    if(!seller){
      seller=document.createElement('section');seller.id='seller-settings-products';seller.className='card seller-settings-products';
      seller.innerHTML=`<div class="seller-settings-head"><div><div class="card-title">Produk</div><div class="page-sub">Atur harga jual dan modal khusus Seller App Premium. Harga langsung sinkron ke Orders.</div></div><div class="seller-settings-head-actions"><button type="button" id="seller-add-product-btn" class="seller-add-product-btn">+ Tambah Produk</button><span id="seller-custom-product-limit" class="seller-custom-product-limit">${esc(sellerCustomLimitText())}</span><span class="seller-settings-db-status">${sellerSettingsReady?'Tersinkron':'Perlu migration'}</span></div></div><div class="seller-settings-toolbar"><div id="seller-settings-category-tabs" class="seller-settings-category-tabs">${CATEGORIES.map(c=>`<button type="button" data-seller-settings-category="${esc(c)}" class="${c===settingsCategory?'active':''}">${esc(c)}</button>`).join('')}</div><input id="seller-settings-search" class="input" placeholder="Cari produk / varian / durasi"></div><div id="seller-settings-products-list"></div><div id="seller-add-product-modal" class="seller-add-product-modal" hidden><div class="seller-add-product-dialog" role="dialog" aria-modal="true" aria-labelledby="seller-add-product-title"><div class="seller-add-product-dialog-head"><div><strong id="seller-add-product-title">Tambah Produk</strong><small>Produk baru langsung tersimpan ke workspace dan muncul di Orders.</small></div><button type="button" class="seller-add-product-close" aria-label="Tutup">×</button></div><form id="seller-add-product-form"><div class="seller-add-product-grid"><label>Kategori<select class="input" name="category" required>${CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label>Nama Produk<input class="input" name="product" placeholder="Contoh: Blackbox AI" required></label><label>Plan / Varian<input class="input" name="variant" placeholder="Contoh: Private" required></label><label>Durasi<input class="input" name="duration" placeholder="Contoh: 1 bulan" required></label><label>Harga<input class="input" name="price" type="number" min="0" step="500" placeholder="0"></label><label>Modal<input class="input" name="cost" type="number" min="0" step="500" placeholder="0"></label></div><div class="seller-add-product-actions"><button type="button" class="seller-add-product-cancel">Batal</button><button type="submit" class="seller-add-product-save">Simpan Produk</button></div></form></div></div>`;
      panel.appendChild(seller);
      seller.querySelector('#seller-add-product-btn')?.addEventListener('click',openSellerProductCreator);
      seller.querySelector('.seller-add-product-close')?.addEventListener('click',closeSellerProductCreator);
      seller.querySelector('.seller-add-product-cancel')?.addEventListener('click',closeSellerProductCreator);
      seller.querySelector('#seller-add-product-modal')?.addEventListener('click',e=>{if(e.target.id==='seller-add-product-modal')closeSellerProductCreator()});
      seller.querySelector('#seller-add-product-form')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.currentTarget.querySelector('.seller-add-product-save');btn.disabled=true;const old=btn.textContent;btn.textContent='Menyimpan...';try{await addCustomSellerProduct(e.currentTarget);showToast('Produk berhasil ditambahkan.');closeSellerProductCreator();installSellerSettings();}catch(err){showToast(err.message||'Gagal menambah produk.',true)}finally{btn.disabled=false;btn.textContent=old}});
      seller.addEventListener('click',async e=>{
        const cat=e.target.closest('[data-seller-settings-category]');
        if(cat){settingsCategory=cat.dataset.sellerSettingsCategory;seller.querySelectorAll('[data-seller-settings-category]').forEach(b=>b.classList.toggle('active',b===cat));renderSellerSettingsProducts();return}
        const save=e.target.closest('.seller-setting-save');if(!save)return;
        const row=save.closest('.seller-settings-option'),key=row?.dataset.sellerSettingKey,base=allEffective().find(x=>rowKey(x)===key);if(!base)return;
        save.disabled=true;const old=save.textContent;save.textContent='Menyimpan...';
        try{await saveSellerSetting(base,row.querySelector('.seller-setting-price')?.value,row.querySelector('.seller-setting-cost')?.value);showToast('Harga & modal tersimpan.');renderSellerSettingsProducts();renderSellerDashboardKpis();}
        catch(err){showToast(err.message||'Gagal menyimpan produk.',true)}
        finally{save.disabled=false;save.textContent=old}
      });
      seller.querySelector('#seller-settings-search').addEventListener('input',e=>{settingsSearch=e.target.value;renderSellerSettingsProducts()});
    }
    const status=seller.querySelector('.seller-settings-db-status');if(status)status.textContent=sellerSettingsReady?'Tersinkron':'Perlu migration';
    updateSellerCustomLimitUI();
    cleanupSellerSettings();
    renderSellerSettingsProducts();
  }

  function cleanupSellerSettings(){
    if(!mounted)return;
    const settings=document.getElementById('settings');if(!settings)return;
    const select=document.getElementById('settings-category-select');
    ['addons','topics'].forEach(key=>{
      select?.querySelector(`option[value="${key}"]`)?.remove();
      document.querySelectorAll(`.saas-settings-submenu-btn[data-settings-category="${key}"],#kairo-mobile-settings-hub [data-settings-category="${key}"]`).forEach(el=>el.remove());
      settings.querySelectorAll(`[data-settings-panel="${key}"]`).forEach(el=>el.classList.add('seller-template-hidden'));
    });
    if(select&&['addons','topics'].includes(select.value)){select.value='packages';select.dispatchEvent(new Event('change',{bubbles:true}))}
    const profit=document.getElementById('profit-share-editor-card');
    if(profit){
      profit.querySelector('.profit-product-divider')?.classList.add('seller-template-hidden');
      profit.querySelector('.profit-product-head')?.classList.add('seller-template-hidden');
      profit.querySelector('#profit-product-rules')?.classList.add('seller-template-hidden');
      profit.querySelector('.profit-product-note')?.classList.add('seller-template-hidden');
    }
    const pageSub=document.querySelector('main.container .page-sub');
    if(document.getElementById('settings')?.classList.contains('active')&&pageSub)pageSub.textContent='Identitas bisnis, produk, pembagian omzet, struk, dan akses workspace aktif.';
  }
  function cleanupSellerPerformance(){
    if(!mounted)return;
    const topicCanvas=document.getElementById('topicChart');const card=topicCanvas?.closest('.card');if(card)card.classList.add('seller-template-hidden');
    const plan=sellerPlan();
    const allowed=plan==='plus'||plan==='pro';
    document.body.classList.toggle('seller-performance-locked',!allowed);
    document.querySelectorAll('[data-tab="performance"]').forEach(el=>{
      el.classList.toggle('seller-performance-locked-nav',!allowed);el.setAttribute('aria-disabled',allowed?'false':'true');
    });
    if(!allowed&&document.getElementById('performance')?.classList.contains('active')){try{openAppPage('dashboard')}catch(_e){}}
  }
  function syncSellerToolbar(){
    if(!mounted)return;
    const active=document.querySelector('.section.active')?.id||'';
    // Seller toolbar policy:
    // show period filters on Dashboard / Performance / Withdraw (and Petty Cash),
    // hide them only on Orders / Promo / Customer Database / Settings.
    const clean=['input','promo','customers','settings'].includes(active);
    document.body.classList.toggle('seller-clean-top-filters',clean);
    const filters=document.querySelector('main.container > .toolbar .filters');if(!filters)return;
    const refresh=[...filters.querySelectorAll('button')].find(b=>(b.textContent||'').toLowerCase().includes('refresh'));
    if(refresh)refresh.classList.toggle('seller-refresh-solo',clean);
    if(active==='settings')cleanupSellerSettings();
    if(active==='performance')cleanupSellerPerformance();
  }
  function syncSellerTemplateChrome(){cleanupSellerSettings();cleanupSellerPerformance();syncSellerToolbar()}

  function wireCoreHooks(){
    try{
      if(typeof openAppPage==='function'&&!openAppPage.__sellerToolbarWrapped){
        const core=openAppPage;const wrapped=function(){
          const r=core.apply(this,arguments);
          if(mounted){setTimeout(syncSellerToolbar,0);setTimeout(syncSellerToolbar,80)}
          return r;
        };wrapped.__sellerToolbarWrapped=true;openAppPage=wrapped;
      }
      if(typeof renderHistory==='function'&&!renderHistory.__sellerWrapped){
        const core=renderHistory;const wrapped=function(){const r=core.apply(this,arguments);if(mounted)renderSellerHistory();return r};wrapped.__sellerWrapped=true;renderHistory=wrapped;
      }
      if(typeof fetchHistoryTransactions==='function'&&!fetchHistoryTransactions.__sellerWrapped){
        const core=fetchHistoryTransactions;const wrapped=async function(){const r=await core.apply(this,arguments);if(mounted){renderSellerHistory();renderSellerDashboardKpis();renderSellerExpiryTracker();renderSellerOutstandingTracker()}return r};wrapped.__sellerWrapped=true;fetchHistoryTransactions=wrapped;
      }
      if(typeof renderDashboard==='function'&&!renderDashboard.__sellerWrapped){
        const core=renderDashboard;const wrapped=function(){
          const r=core.apply(this,arguments);
          if(mounted)requestAnimationFrame(syncSellerDashboardView);
          return r;
        };wrapped.__sellerWrapped=true;renderDashboard=wrapped;
      }
      if(typeof renderCustomerDatabase==='function'&&!renderCustomerDatabase.__sellerWrapped){
        const core=renderCustomerDatabase;const wrapped=function(){const r=core.apply(this,arguments);if(mounted)decorateCustomerDatabase();return r};wrapped.__sellerWrapped=true;renderCustomerDatabase=wrapped;
      }
      if(typeof loadCustomerDirectory==='function'&&!loadCustomerDirectory.__sellerWrapped){
        const core=loadCustomerDirectory;const wrapped=async function(){const r=await core.apply(this,arguments);if(mounted)await loadSellerCustomerMeta();return r};wrapped.__sellerWrapped=true;loadCustomerDirectory=wrapped;
      }
      if(typeof chooseExistingCustomer==='function'&&!chooseExistingCustomer.__sellerWrapped){
        const core=chooseExistingCustomer;const wrapped=function(id){const r=core.apply(this,arguments),m=sellerCustomerMeta.get(String(id));if(m){const d=document.getElementById('seller-device'),a=document.getElementById('seller-admin-fh'),w=document.getElementById('seller-warranty');if(d)d.value=m.device||'';if(a)a.value=m.admin_fh||'';if(w)w.value=m.warranty||''}return r};wrapped.__sellerWrapped=true;chooseExistingCustomer=wrapped;
      }
      if(typeof ensureCustomerForPendingTransaction==='function'&&!ensureCustomerForPendingTransaction.__sellerWrapped){
        const core=ensureCustomerForPendingTransaction;const wrapped=async function(){
          const id=await core.apply(this,arguments);
          if(mounted&&id&&pendingTransactionPayload&&isSellerTx(pendingTransactionPayload)){
            const payload={device:pendingTransactionPayload.device||null,admin_fh:pendingTransactionPayload.admin_fh||null,warranty:pendingTransactionPayload.warranty||null};
            const {error}=await db.from('customers').update(payload).eq('workspace_id',requireWorkspaceId()).eq('id',id);
            if(error)throw new Error('Metadata seller gagal disimpan. Pastikan migration v20.10.121 sudah dijalankan: '+error.message);
            sellerCustomerMeta.set(String(id),{id,...payload});
          }
          return id;
        };wrapped.__sellerWrapped=true;ensureCustomerForPendingTransaction=wrapped;
      }
      if(typeof resetTxForm==='function'&&!resetTxForm.__sellerWrapped){
        const core=resetTxForm;const wrapped=function(){const r=core.apply(this,arguments);if(mounted)resetSellerState();return r};wrapped.__sellerWrapped=true;resetTxForm=wrapped;
      }
    }catch(err){console.warn('Seller core hook:',err)}
    installReceiptExtras();
  }


  // v20.10.127 — seller dashboard/mobile reconciliation without observers.
  function hideGenericSellerDashboardHistory(){
    if(!mounted)return;
    const dash=document.getElementById('dashboard');
    if(!dash)return;
    document.getElementById('transaction-history-card')?.classList.add('seller-core-history-hidden');
    const body=document.getElementById('tx-table-body');
    const genericCard=body?.closest('.card,section,article');
    if(genericCard && genericCard.id!=='seller-dashboard-history-card') genericCard.classList.add('seller-core-history-hidden');
    dash.querySelectorAll('table').forEach(table=>{
      const text=(table.textContent||'').toLowerCase();
      if(text.includes('start reading') && text.includes('tanggal') && text.includes('status')){
        const holder=table.closest('.card,section,article');
        if(holder && holder.id!=='seller-dashboard-history-card') holder.classList.add('seller-core-history-hidden');
      }
    });
  }
  function syncSellerUserFacingWording(){
    if(!mounted)return;
    const promoName=document.getElementById('promo-name');
    if(promoName)promoName.placeholder='Contoh: Promo Netflix September';
  }
  function syncSellerDashboardView(){
    if(!mounted||!document.body.classList.contains('seller-app-premium'))return;
    hideGenericSellerDashboardHistory();
    syncSellerUserFacingWording();
    installSellerDashboardHistory();
    installSellerExpiryTracker();
    installSellerOutstandingTracker();
    renderSellerHistory();
    renderSellerDashboardKpis();
    renderSellerExpiryTracker();
    renderSellerOutstandingTracker();
    hideGenericSellerDashboardHistory();
  }

  function mount(){
    if(mounted||!document.body.classList.contains('authenticated'))return;
    const form=document.getElementById('tx-form'),packages=document.getElementById('tx-packages');if(!form||!packages)return;
    mounted=true;document.body.classList.add('seller-app-premium');
    hideGenericMasterAreas();wireCoreHooks();

    const host=document.createElement('section');host.id='seller-app-premium-template';host.className='seller-app-panel';
    host.innerHTML=`<div class="seller-app-head"><div><h3>Buat Pesanan Baru</h3><p>Pilih kategori, cari produk, lalu tentukan plan dan durasi.</p></div></div><div class="seller-app-field seller-category-field"><label>Kategori</label><div id="seller-category-grid" class="seller-category-grid"></div></div><div class="seller-app-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="seller-product-search" type="search" placeholder="Cari produk, contoh: Netflix, Canva, ChatGPT..."></div><div class="seller-app-field"><label>Pilih Produk</label><div id="seller-product-grid" class="seller-product-grid"></div></div><div class="seller-app-field" id="seller-variant-section" hidden><label>Plan / Varian</label><div id="seller-variant-grid" class="seller-choice-grid"></div></div><div class="seller-app-field" id="seller-duration-section" hidden><label>Durasi</label><div id="seller-duration-grid" class="seller-choice-grid"></div></div><div class="seller-selection" id="seller-selection" hidden><div><small>Harga pilihan</small><strong id="seller-selected-price">—</strong><span id="seller-selected-meta">Pilih paket</span></div><button id="seller-add-order" type="button">+ Tambah ke Pesanan</button></div>`;

    const packageBox=packages.closest('.form-group')||packages.parentElement;(packageBox||form.firstChild).insertAdjacentElement('beforebegin',host);
    installExtraFields();
    installSellerPaymentField();

    const submit=form.querySelector('button[type="submit"],input[type="submit"]'),cartBox=document.createElement('section');
    cartBox.id='seller-cart-preview';cartBox.className='seller-cart-panel';
    cartBox.innerHTML=`<div class="seller-cart-head"><div><span>Ringkasan Pesanan</span><small id="seller-cart-count">0 item</small></div></div><div id="seller-cart-empty" class="seller-cart-empty">Belum ada paket dipilih.</div><div id="seller-cart-list"></div><div class="seller-cart-total"><span>Total</span><strong id="seller-cart-total">Rp0</strong></div>`;
    if(submit)submit.insertAdjacentElement('beforebegin',cartBox);else form.appendChild(cartBox);
    installCompactActions(form,cartBox);
    installSellerOrderLayout(form);
    ensureSellerEmptyPaymentOption();
    resetSellerChoiceField('tx-payment');

    document.getElementById('seller-product-search').addEventListener('input',e=>{searchQuery=e.target.value.trim();if(searchQuery){product='';variant='';duration=''}renderProducts();renderVariants()});
    host.addEventListener('click',e=>{
      const c=e.target.closest('[data-seller-category]');if(c){category=c.dataset.sellerCategory;searchQuery='';const q=document.getElementById('seller-product-search');if(q)q.value='';product='';variant='';duration='';renderProducts();renderVariants();return}
      const p=e.target.closest('[data-seller-product]');if(p){category=p.dataset.sellerProductCategory;product=p.dataset.sellerProduct;variant='';duration='';searchQuery='';const q=document.getElementById('seller-product-search');if(q)q.value='';renderProducts();renderVariants();return}
      const v=e.target.closest('[data-seller-variant]');if(v){variant=v.dataset.sellerVariant;duration='';renderVariants();return}
      const d=e.target.closest('[data-seller-duration]');if(d){duration=d.dataset.sellerDuration;renderDurations();return}
    });
    document.getElementById('seller-add-order').addEventListener('click',addSelected);
    cartBox.addEventListener('click',e=>{let i;if((i=e.target.dataset.sellerPlus)!==undefined){cart[+i].qty++;renderCart()}else if((i=e.target.dataset.sellerMinus)!==undefined){cart[+i].qty=Math.max(1,cart[+i].qty-1);renderCart()}else if((i=e.target.dataset.sellerRemove)!==undefined){cart.splice(+i,1);renderCart()}});
    form.addEventListener('submit',interceptSubmit,true);
    ['tx-adjustment-type','tx-adjustment-mode','tx-adjustment-value','tx-tip'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{renderCart();renderSellerPaymentPreview()}));
    ['tx-adjustment-type','tx-adjustment-mode'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{renderCart();renderSellerPaymentPreview()}));

    document.addEventListener('click',e=>{
      const perfTarget=e.target.closest('[data-tab="performance"]');
      if(perfTarget){
        const plan=sellerPlan();
        if(!['plus','pro'].includes(plan)){e.preventDefault();e.stopImmediatePropagation();try{showToast('Performance tersedia untuk paket PLUS dan PRO.',true)}catch(_e){};return}
      }
      if(e.target.closest('#saas-settings-btn,#saas-settings-side-btn,[data-settings-category="packages"]'))setTimeout(()=>{installSellerSettings();cleanupSellerSettings();syncSellerToolbar()},40);
      if(e.target.closest('#app-shell [data-tab],.kairo-mobile-orders-main,#saas-settings-btn,#saas-settings-side-btn')){
        setTimeout(()=>{syncSellerTemplateChrome();syncSellerUserFacingWording()},40);setTimeout(()=>{syncSellerTemplateChrome();syncSellerUserFacingWording()},180);
      }
      if(e.target.closest('[data-tab="dashboard"]')){
        requestAnimationFrame(syncSellerDashboardView);
      }
      if(!cart.length&&category&&!e.target.closest('#seller-app-premium-template'))clearSellerBrowseSelection();
    },true);

    renderCategories();renderProducts();renderVariants();renderDurations();renderCart();
    syncSellerDashboardView();installSellerSettings();syncSellerTemplateChrome();syncSellerUserFacingWording();
    loadSellerProductSettings();loadSellerCustomerMeta();
    // If the seller module boots while Dashboard is already visible (first login),
    // repaint the existing dashboard immediately so seller KPI/history styling does
    // not wait for the user to switch tabs first.
    setTimeout(()=>{
      try{ if(typeof renderDashboard==='function') renderDashboard(); }catch(_e){}
      syncSellerDashboardView();
    },80);
    [80,260,700,1400].forEach(ms=>setTimeout(syncSellerTemplateChrome,ms));
  }

  function maybeMount(){if(document.body.classList.contains('authenticated'))mount()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(maybeMount,0),{once:true});else setTimeout(maybeMount,0);
  document.addEventListener('click',e=>{if(e.target.closest('[data-tab="input"],.kairo-mobile-orders-main'))setTimeout(maybeMount,0)},true);
  window.addEventListener('pageshow',()=>{if(mounted)requestAnimationFrame(syncSellerDashboardView)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&mounted)requestAnimationFrame(syncSellerDashboardView)});
})();
