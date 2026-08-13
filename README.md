# AI League Coach

Riot Games maç verilerini analiz ederek oyunculara kişiselleştirilmiş performans analizi,
benzer oyuncularla kıyaslama, macro/alışkanlık analizi ve AI destekli gelişim önerileri
sunan bir platform.

Pipeline: **Riot API → Match Data → İstatistiksel Analiz → Macro/Habit Analizi → AI Coach.**

## Gereksinimler

- Node.js 20+
- Bir Supabase projesi (ücretsiz tier yeterli) — veritabanı için
- Bir Riot Games Developer API key
- (AI Coach için) Bedrock proxy API erişimi — `BEDROCK_API_KEY` / `BEDROCK_API_URL`

## 1. Riot API key alma

1. https://developer.riotgames.com/ adresine Riot Games hesabınla giriş yap.
2. Ana sayfada görünen **development API key**'i kopyala (24 saatte bir yenilenmesi
   gerekir — test için yeterli).
3. `.env` dosyasına `RIOT_API_KEY` olarak ekle (aşağıya bak).

## 2. Supabase kurulumu

**Bu proje için mutlaka yeni, boş bir Supabase projesi oluştur — başka bir uygulamanın
kullandığı projeyi paylaşma.** `prisma migrate dev`, hedef veritabanının `public`
şemasındaki HER tabloyu (ve `auth` şemasını dahil edersen onu da) kendi yönettiği şema
olarak ele alır; paylaşılan bir projede zaten var olan tablolarla (ör. başka bir uygulamanın
`meals`, `auth.users` gibi tabloları) karşılaşınca migration'ı ilerletemez ve tek çözüm
olarak `prisma migrate reset`'i önerir — bu da **o projedeki TÜM şemaları ve verileri siler**
(diğer uygulamanın kullanıcıları/auth sistemi dahil). Bunu bizzat yaşadık, kimse zarar
görmedi çünkü reset komutu hiç çalıştırılmadı, ama bir daha aynı projeyi kullanmayalım.

1. https://supabase.com üzerinde **bu proje için özel, yeni** bir proje oluştur.
2. Project Settings → Database → **Connection string** sayfasına git.
3. İki bağlantı stringi kopyalanacak:
   - **Transaction pooler** (port 6543) → `.env`'de `DATABASE_URL`
   - **Direct connection** (port 5432) → `.env`'de `DIRECT_URL` (yalnızca migration için
     kullanılır; pooler bağlantısı `prisma migrate`'in ihtiyaç duyduğu bazı işlemleri
     desteklemiyor)
4. Her ikisindeki `[YOUR-PASSWORD]` kısmını proje şifreyle değiştir — **köşeli parantezleri
   de sil**, sadece şifrenin kendisi kalsın (`...postgres.xxxx:GERÇEK_ŞİFRE@...`). Şifrende
   `@`, `:`, `/`, `?`, `#`, `%` gibi özel karakterler varsa URL-encode etmen gerekir.

## 3. Ortam değişkenleri

```bash
cp .env.example .env
```

- `DATABASE_URL` / `DIRECT_URL`: yukarıdaki Supabase connection string'lerini yapıştır.
- `BEDROCK_API_KEY` / `BEDROCK_API_URL`: AI Coach bölümü için gerekli. Bu proje,
  kisisel-web-sitesi kök projesindeki (`api/chat.py`) ile aynı akademi-sağlanan Bedrock
  Converse API proxy'sini kullanır (model: `google.gemma-3-27b-it`) — o projenin `.env`
  dosyasındaki değerleri buraya kopyala. Bu ikisi olmadan diğer her şey çalışır, yalnızca
  AI Coach paneli hata verir.

## 4. Bağımlılıklar ve veritabanı şeması

```bash
npm install
npx prisma migrate dev --name init
```

## 5. Geliştirme sunucusu

```bash
npm run dev
```

http://localhost:3000 üzerinden Riot ID'ni (`gameName#tagLine`) ve bölgeni (platform
routing, örn. `euw1`, `na1`, `kr`) girerek arama yapabilirsin. Profil sayfası bir dashboard
olarak açılır:

- **Overview / Performance / Trends** — win rate, recent form, 0-100 Farming/Combat/Vision/
  Objective/Consistency skorları, CS/min trend grafiği
- **AI Coach** — "AI Coach özeti oluştur" butonuyla tetiklenir, Bedrock proxy üzerinden
  Gemma 3'e gönderilip cache'lenir
- **Habits / Macro Impact** — tekrar eden davranışlar (örn. "Early Dragon Tendency") ve
  reset zamanlaması ile win rate arasındaki gözlemlenen ilişki
- **Son Maçlar** tablosu — her satır, o maçın detay sayfasına (KDA/CS/vision detayları +
  macro event timeline'ı) bağlanır

"Refresh matches" butonu son maçları (+ timeline'larını) senkronize eder.

## Proje yapısı

```
src/
  app/                       # Next.js App Router sayfaları + API route'ları
    player/[puuid]/          # Dashboard (Overview, Performance, Trends, Habits, AI Coach)
    player/[puuid]/match/[matchId]/  # Tekil maç detayı + macro timeline
  lib/
    riot/                    # Riot API client, rate limiter, region routing, tipler
    db.ts                    # Prisma client singleton
  server/services/
    playerService.ts         # Riot API + DB orkestrasyonu, dashboard birleşimi
    matchService.ts          # Match + timeline senkronizasyonu
    statsService.ts          # CS/gold/xp/min, KDA, damage share, advantage hesapları
    benchmarkService.ts      # Şampiyon+rol(+patch) bazlı cohort kıyaslaması
    performanceScore.ts      # 0-100 kategori skorları
    macroService.ts          # Timeline event çıkarımı (kill/objective/recall proxy)
    habitService.ts          # Tekrar eden davranış tespiti + macro impact korelasyonu
    aiCoachService.ts        # Bedrock Converse API çağrısı + özet cache'leme
prisma/schema.prisma          # Player, Rank, Match, MatchParticipant, MatchTimeline, AiCoachSummary
```

## Bilinen sınırlamalar

- **Benchmark cohort**: yalnızca senkronize edilmiş maçlardaki katılımcılardan oluşur
  (rank/region filtresi yok — bu veri elimizde yok). Az maçla örneklem küçük kalır, zamanla
  büyür.
- **Recall/reset tespiti**: Riot timeline API'sinde ayrı bir "recall" event tipi yok; aynı
  1 dakikalık çerçevede 2+ item satın alımı yaklaşık bir reset göstergesi olarak kullanılır.
- **Macro impact / habit detection**: gözlemsel korelasyondur, nedensellik iddia etmez;
  güvenilir olması için en az birkaç düzine timeline'lı maç gerekir.
- **AI Coach**: Gemma 3 27B kullanır (Claude değil) — akademi proxy'sinin sağladığı model bu.
