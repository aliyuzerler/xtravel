# Turizm Pazaryeri — App Store / Google Play Listing Hazırlığı

## App Store (iOS) Bilgileri

### Temel Bilgiler
- **Uygulama Adı**: Turizm Pazaryeri
- **Alt Başlık**: Tur hizmetleri pazaryeri
- **Bundle ID**: com.turizmpazaryeri.app
- **SKU**: TP-2025
- **Birincil Dil**: Türkçe
- **Birincil Kategori**: Seyahat
- **İkincil Kategori**: Yaşam Tarzı

### Açıklama (4500 karakter)
Turizm Pazaryeri, Türkiye'nin her şehrinde unutulmaz deneyimler sunan bir tur hizmetleri pazaryeridir. Kültür turları, gemi gezileri, doğa yürüyüşleri, müze ziyaretleri ve daha fazlasını tek bir uygulamada keşfedin.

**Özellikler:**
• 81 ilde binlerce tur hizmeti
• Güvenli iyzico ödeme altyapısı
• 24 saat öncesine kadar ücretsiz iptal
• Anlık rezervasyon onayı ve bildirimler
• Mobil ödeme ve dijital bilet
• Sağlayıcı paneli ile rezervasyon yönetimi
• Türkçe arayüz, 7/24 destek

**Nasıl Çalışır?**
1. Şehir, kategori veya anahtar kelime ile hizmet ara
2. Detayları, fotoğrafları ve müsait tarihleri incele
3. Size uygun fiyat varyantını ve kişi sayısını seç
4. Güvenle ödeme yap, rezervasyon kodunu al
5. Tur günü buluşma noktasına git, deneyimin tadını çıkar

**Güvenli Ödeme**
iyzico güvencesiyle tüm ödemeleriniz güvence altındadır. Kart bilgileriniz hiçbir zaman sunucularımızda saklanmaz.

**Esnek İptal Politikası**
Tur başlangıcından 24 saat öncesine kadar ücretsiz iptal. 12-24 saat arası %50 iade. Son 12 saatte iade yapılmaz.

### Anahtar Kelimeler (100 karakter)
tur,turizm,kültür turu,gemi turu,şehir turu,doğa yürüyüşü,müze gezisi,rezevasyon,antalya,istanbul,izmir

### Destek URL
https://turizmpazaryeri.com/destek

### Marketing URL
https://turizmpazaryeri.com

### Privacy Policy URL
https://turizmpazaryeri.com/gizlilik

---

## Google Play (Android) Bilgileri

### Temel Bilgiler
- **Uygulama Adı**: Turizm Pazaryeri
- **Kısa Açıklama (80 karakter)**: Türkiye'nin her şehrinde tur hizmetleri — kültür, gemi, doğa turları
- **Uygulama Açıklaması (4000 karakter)**: (iOS ile aynı açıklama)

### Kategori
- **Birincil**: SEYAHAT_VE_YEREL
- **İkincil**: YAŞAM

### İçerik Derecelendirme
- **Herkes** (3+)

### Hedef Kitle
- **Yaş**: 18+ (gerçek para işlemi var)
- **Hedef**: T (Teen) — Tüm yaşlar

---

## Görsel Varlıklar

### Uygulama İkonu
- **iOS**: 1024x1024 PNG (icon.png), yuvarlatılmış köşeler otomatik
- **Android adaptive icon**: 1024x1024 PNG (adaptive-icon.png), arka plan lacivert (#0F2D52)

### Splash Ekranı
- **Dosya**: splash.png, 1242x2436 PNG
- **Arka plan rengi**: #0F2D52 (lacivert)
- **Logo**: Beyaz yazı ile "Turizm Pazaryeri"

### Ekran Görüntüleri (her platform için)
- **iOS**: 6.7" iPhone (1290x2796), 5.5" iPhone (1242x2208), iPad (2048x2732)
- **Android**: 1080x1920 PNG

#### Ekran Görüntüsü Planı (her platform için 5 adet)
1. **Ana Sayfa**: Hero arama + kategoriler + öne çıkanlar
2. **Hizmet Detayı**: Galerisi + takvim + alt fiyat çubuğu
3. **Checkout Özeti**: Sipariş özeti + iletişim formu
4. **Rezervasyonlarım**: Sekmeli görünüm (gelecek/geçmiş/iptal)
5. **Profil**: Kullanıcı bilgileri + menü

### Açıklama Video (opsiyonel)
- 15-30 saniye
- Rezervasyon akışı: arama → seçim → ödeme → sonuç

---

## Yerelleştirme

### Desteklenen Diller
- **tr-TR**: Türkçe (ana dil)
- (İleride eklenebilir: en-US)

### Çeviri Notları
- Tüm UI metinleri Türkçe
- Para birimi: TRY (₺)
- Tarih formatı: GG.AA.YYYY
- Saat formatı: 24s

---

## İzinler ve Açıklamaları

### iOS Info.plist
- `NSCameraUsageDescription`: "Profil fotoğrafı eklemek için kamera erişimi gerekli."
- `NSPhotoLibraryUsageDescription`: "Profil fotoğrafı seçmek için galeri erişimi gerekli."
- `NSLocationWhenInUseUsageDescription`: "Yakınındaki turları önermek için konum erişimi gerekli."

### Android Manifest
- `INTERNET`: API çağrıları için
- `ACCESS_FINE_LOCATION`: (opsiyonel) Yakın turlar için
- `POST_NOTIFICATIONS`: Push bildirimler için (Android 13+)

### Push Bildirimler
- **iOS**: APNs sertifikası gerekli
- **Android**: FCM (Firebase Cloud Messaging) — Expo Notifications otomatik kullanır

---

## Derin Link Yapılandırması

### iOS (Universal Links)
- Associated Domains: `applinks:turizmpazaryeri.com`
- apple-app-site-association dosyası: `https://turizmpazaryeri.com/.well-known/apple-app-site-association`

### Android (App Links)
- Intent filter: `https://turizmpazaryeri.com/hizmet/[slug]`
- assetlinks.json dosyası: `https://turizmpazaryeri.com/.well-known/assetlinks.json`

### Custom Scheme
- `turizmpazaryeri://` — uygulama içi navigasyon

---

## Üretim Dağıtım Checklist

### Pre-submit
- [ ] Tüm ortam değişkenleri production değerleriyle güncellendi
- [ ] API_BASE_URL production URL'ine işaret ediyor
- [ ] iyzico production API key yüklendi
- [ ] Push notification sertifikaları (APNs + FCM) hazır
- [ ] Universal Links / App Links için backend redirect'leri hazır
- [ ] Privacy Policy ve Terms of Use sayfaları yayınlandı

### Submit
- [ ] App Store Connect'e upload
- [ ] Google Play Console'a upload
- [ ] Ekran görüntüleri ve açıklamalar eklendi
- [ ] İçerik derecelendirme anketi dolduruldu
- [ ] Veri güvenliği formu dolduruldu

### Post-submit
- [ ] TestFlight ile beta test (iOS)
- [ ] Internal testing track (Android)
- [ ] Production release

---

## Sürüm Notları (v1.0.0)

İlk sürüm! Türkiye'nin her şehrinde tur hizmetleri pazaryeri.

**Öne çıkanlar:**
• 81 ilde tur hizmeti keşfetme
• Güvenli iyzico ödeme
• Anlık rezervasyon onayı ve push bildirimler
• 24 saat öncesine kadar ücretsiz iptal
• Türkçe arayüz

İyi yolculuklar!
