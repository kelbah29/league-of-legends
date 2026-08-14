# AI League Coach — Proje Planı ve Durum Raporu

**Repo:** https://github.com/kelbah29/league-of-legends
**Canlı:** https://league-of-legends-olive.vercel.app
**Stack:** Next.js 16 (App Router, TypeScript) · Prisma 6 · Supabase (PostgreSQL) · Recharts · Bedrock (Gemma 3 27B)

---

## 1. Görev Tanımına Uygunluk

Ödevde istenen dört maddenin karşılanma durumu:

### ✅ Madde 1 — Performans (% win rate) şampiyon, rol, derece, bölge, patch bazlı karşılaştırma

| Boyut | Durum | Nerede |
|---|---|---|
| Şampiyon | ✅ | `playerService.computeChampionRoleBreakdown` — şampiyon+rol başına win rate |
| Rol | ✅ | `playerService.computeRoleWinRates` — TOP/JUNGLE/MID/BOT/SUP ayrı win rate |
| Patch | ✅ | `benchmarkService.patchPrefix` — cohort önce patch'e göre filtrelenir |
| Diğer oyuncularla kıyas | ✅ | `benchmarkService.getWinRateCohort` — "senin %67 / benzer oyuncular %33" |
| Derece (rank) | ⚠️ Kapsam dışı | Riot, maçtaki diğer 9 oyuncunun rank'ini maç verisinde vermiyor. Her oyuncu için ayrı League-v4 çağrısı gerekir (maç başına ~9 ekstra istek); development key rate limiti altında pratik değil. |
| Bölge (region) | ⚠️ Kapsam dışı | Aynı sebep — katılımcıların region bilgisi maç verisinde yok. |

### ✅ Madde 2 — CS, gold, XP, KDA, vision, damage, objective katılımı

Yedi metriğin tamamı hesaplanıyor (`statsService.computeMatchMetrics`) ve **üç ayrı eksende** karşılaştırılıyor:

1. **Lane rakibine karşı:** `csAdvantage`, `goldAdvantage`, `xpAdvantage` (aynı roldeki rakiple fark)
2. **Takım içi:** `damageShare` (takımın toplam hasarına oranı), `killParticipation`
3. **Diğer oyuncularla:** `benchmarkService.getMetricCohort` — CS/min, gold/min, KDA, vision/min, damage/min, objective participation için aynı şampiyon+rol(+patch) cohort'una göre yüzde fark
4. **Kendi geçmişine karşı:** Trends grafiği (maç bazlı CS/min seyri) + `computeConsistencyScore`

### ✅ Madde 3 — Macro eylemler + kazanmaya etkisi (+50 bonus hedefi)

`macroService.extractMacroEvents` timeline'dan şu olayları çıkarıyor:

| Olay | Kaynak |
|---|---|
| Reset / recall | `ITEM_PURCHASED` kümelenmesi (yaklaşıklık — aşağıya bak) |
| Dragon / Baron / Herald | `ELITE_MONSTER_KILL` |
| Turret | `BUILDING_KILL` |
| **Lane push** | `TURRET_PLATE_DESTROYED` |
| Kill / Death / Assist | `CHAMPION_KILL` |
| Ward | `WARD_PLACED` |

**Kazanmaya etkisi (bonus hedefi):** `habitService.analyzePlayerMacroHabits` içindeki *Macro Impact* analizi — "dragon öncesi 3 dakika içinde reset atılan maçlar" ile "geç/hiç reset atılmayan maçlar" gruplarının win rate'lerini karşılaştırıp örneklem büyüklüğüyle birlikte raporluyor. Her iki grupta da minimum 3 maç yoksa "yetersiz örneklem" diyor. Dil bilinçli olarak korelasyonel: *"Bu bir ilişki gözlemidir, nedensellik iddiası değildir."*

### ✅ Madde 4 — Maçlar boyu devam eden alışkanlıklar

`habitService` üç kural tabanlı alışkanlık tespit ediyor (min. 5 timeline'lı maç gerekiyor):

| Alışkanlık | Kural |
|---|---|
| **Early Dragon Tendency** | Maçların ≥%40'ında 10. dakikadan önce dragon takedown'a katılım |
| **Late Reset Tendency** | Maçların ≥%60'ında ilk reset 4. dakikadan sonra |
| **Lane Commitment** | Maçların ≥%50'sinde 20. dakikaya kadar pozisyonun ağırlıklı olarak lane bölgesinde (ödevdeki "20. dakikaya kadar laneden ayrılmamak" örneği) |

---

## 2. Mimari

```
Riot API → Match + Timeline Data → İstatistiksel Analiz → Macro/Habit Analizi → AI Coach
```

| Katman | Dosya | Sorumluluk |
|---|---|---|
| API client | `src/lib/riot/client.ts` | Bearer auth, hata yönetimi, 429 retry |
| | `src/lib/riot/rateLimiter.ts` | Sliding-window (20/1s, 100/2dk) — dev key limitleri |
| | `src/lib/riot/regions.ts` | platform (euw1/tr1…) ↔ regional (europe/asia…) eşleme |
| Veri çekme | `server/services/playerService.ts` | account-v1 → summoner-v4 → league-v4 |
| | `server/services/matchService.ts` | match-v5 + timeline senkronizasyonu |
| Analiz | `server/services/statsService.ts` | CS/gold/XP/min, KDA, damage share, lane advantage |
| | `server/services/benchmarkService.ts` | Cohort kıyaslaması (metrik + win rate) |
| | `server/services/performanceScore.ts` | 0-100 kategori skorları + consistency |
| | `server/services/macroService.ts` | Timeline event çıkarımı |
| | `server/services/laneCommitmentService.ts` | Pozisyon bazlı lane commitment oranı |
| | `server/services/habitService.ts` | Alışkanlık tespiti + macro impact korelasyonu |
| AI | `server/services/aiCoachService.ts` | Bedrock Converse API + özet cache'leme |

**Veri modeli:** `Player`, `Rank`, `Match`, `MatchParticipant`, `MatchTimeline`, `AiCoachSummary`

**Önemli tasarım kararı:** Maç ve timeline'ların ham JSON'u (`rawData`) DB'de saklanıyor. Bu sayede yeni bir analiz eklendiğinde (örn. lane commitment) Riot API'yi tekrar çağırmadan geçmiş maçlar üzerinden hesaplanabiliyor.

---

## 3. Doğrulama Durumu

| Bileşen | Durum |
|---|---|
| Build + lint | ✅ Temiz |
| Prisma migration (Supabase) | ✅ Uygulandı |
| Riot API entegrasyonu | ✅ Canlıda doğrulandı (`CometStar#Hank` → puuid çözümlendi) |
| İstatistik + benchmark | ✅ Fixture verisiyle uçtan uca doğrulandı |
| Performance score | ✅ Doğrulandı (Farming 51, Combat 62, Vision 55, Objective 38) |
| Champion & Role analizi | ✅ Doğrulandı (win rate %67 / benzer %33) |
| Macro timeline | ✅ Doğrulandı (Lane Push, Recall, Dragon olayları) |
| Habit detection | ✅ Doğrulandı (Early Dragon 3/6, Late Reset 4/6, Lane Commitment 4/6) |
| Macro impact | ✅ Doğrulandı |
| AI Coach | ⚠️ Protokol doğru, **günlük token kotası dolu** (429) — kota yenilenince çalışır |
| Vercel deployment | ✅ Canlı, 200 dönüyor |

**Not:** Gerçek maç verisiyle test edilemedi çünkü elimizdeki Riot hesabı (`CometStar#Hank`) hiç League of Legends oynamamış (10 platformun hepsi kontrol edildi). Bu yüzden `scripts/seed-fixture.mjs` ile 6 maçlık sentetik veri üretilip tüm pipeline gerçek DB üzerinden doğrulandı, ardından test verisi temizlendi. Gerçek oynanmış bir hesap bulunduğunda ek bir kod değişikliği gerekmeden çalışacaktır.

---

## 4. Bilinen Sınırlamalar (bilinçli tasarım kararları)

1. **Recall tespiti yaklaşıktır.** Riot timeline'ında "recall" diye bir event tipi yok. Aynı 1 dakikalık frame içinde 2+ item satın alımı reset göstergesi olarak kullanılıyor. Tek item alınan resetleri kaçırır; frame granülaritesi 1 dakika olduğu için saniye hassasiyeti yok. Kodda ve arayüzde açıkça belirtiliyor.

2. **Lane commitment kaba bir yaklaşımdır.** Riot lane sınırlarını yayınlamıyor; rol başına yaklaşık bir "lane anchor" noktası ve geniş bir yarıçap (5000 birim) kullanılıyor. Jungle rolü, sabit lane'i olmadığı için hariç tutuluyor.

3. **Cohort'ta rank/region filtresi yok.** Yalnızca DB'de biriken katılımcılardan oluşuyor (bkz. Madde 1 tablosu). Az maçla örneklem küçük kalır; sistem yeterli örneklem yoksa (patch'li ≥5, patch'siz ≥3) kıyaslamayı hiç göstermiyor.

4. **Macro impact korelasyoneldir, nedensel değildir.** Karıştırıcı değişkenler (takım gücü, şampiyon, rakip seviyesi) kontrol edilmiyor. Ödev metnindeki "bu davranış ile maç sonucu arasında ilişki gözlemlendi" dili birebir korunuyor.

5. **AI Coach modeli Gemma 3 27B'dir**, Claude değil — akademi Bedrock hesabının sağladığı model bu.

---

## 5. Sonraki Adımlar

**Kısa vadede:**
- Gerçek oynanmış bir Riot hesabıyla uçtan uca test
- Bedrock kotası yenilenince AI Coach çıktısını doğrula
- `scripts/seed-fixture.mjs` — geliştirme aracı olarak duruyor, üretimde kullanılmıyor

**Genişletme fikirleri:**
- Rank/region cohort'u: arama yapılan oyuncuların rank'lerini biriktirip zamanla filtreli kıyaslama
- Daha fazla metrik için trend grafiği (şu an yalnızca CS/min)
- Zaman dilimi bazlı analiz (0-10 / 10-20 / 20+ dk) — ham timeline verisi zaten DB'de
- Dönem karşılaştırması ("son 10 maç" vs "önceki 10 maç")
- Riot dev key 24 saatte bir yenileniyor; kalıcı kullanım için production key başvurusu gerekir
