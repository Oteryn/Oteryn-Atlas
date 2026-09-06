# Oteryn Atlas — pogłębiony audyt techniczny, wersja 2

**Data badania:** 6 września 2026 r.  
**Repozytorium:** `Oteryn/Oteryn-Atlas`  
**Badany commit:** `51623c7dab2346cee39cd51e3caa845bf4b65426`  
**Git tree:** `8d5b8f1ea3bf636698b8cf7cc81fe434f19f58df`  
**Charakter pracy:** analiza i lokalne eksperymenty; bez zmian w GitHub, workflow, rulesetach, gałęziach, publikacji lub na hostach użytkownika.

> **Granica zapewnienia:** to pogłębiony audyt wybranych krytycznych ścieżek oraz architektury repozytorium, nie certyfikat kompletności całego produktu. Nie uzyskano pełnego checkoutu, nie uruchomiono całego zestawu testów repozytorium, produkcyjnego FullWorld ani końcowej akceptacji aplikacji w przeglądarce. Wykonano natomiast rzeczywisty generator publikacji na dwóch małych, syntetycznych zestawach, rzeczywiste loadery, testy awarii i eksperyment mutacyjny. Zakres każdego wyniku podano osobno.

## 1. Podstawa dowodowa i główny wniosek

**FACT.** GitHub na początku i przy końcowym odczycie tej fazy wskazywał ten sam `main`. Pliki użyte do wykonania eksperymentów odtworzono z konektora i sprawdzono przez porównanie pełnego Git blob SHA, a nie przez podobieństwo fragmentu tekstu. `source-manifest.json` zawiera 13 takich plików, ich rozmiary i identyfikatory. Jeden z nich, generator indeksu stworzeń, zachowano z pierwszego audytu i ponownie sprawdzono jego blob; nie przedstawiono go jako nowego eksperymentu. Zbiór `sources/` nie jest checkoutem Git. [S01–S13; G01]

**FACT.** Wykonanie ujawniło między innymi: niezgodność serializacji producenta Python z konsumentem JavaScript; usuwanie wejścia generatora przy kolizji katalogu wyjściowego; przerwanie poprawnego ładowania przez awarię pomocniczego cache; błędne liczenie pamięci cache przy równoległych żądaniach; niespójny round-trip współrzędnych przy granicy; oraz niepełne odrzucanie nieprawidłowych danych przez pomocniczy oracle geometrii. Surowe wyniki znajdują się w `results/`.

**INFERENCE — pewność wysoka dla badanych ścieżek.** Problemy Atlasa nie sprowadzają się do nadmiaru promptów i CI. Istnieje również dług na styku producent–konsument oraz w obsłudze błędów. Przywrócenie poprzedniego systemu uruchamiania testów samo w sobie nie usuwa tych usterek. Szczególnie ważne jest, że cztery niezmienione testy istniejące w repozytorium przeszły, mimo że dodatkowe próby wykazały istotne niepokryte zachowania.

**RECOMMENDATION.** Zachować rozdział Game/Atlas, tożsamości treści i normalną integrację PR/MQ. Nie wykonywać pełnego rewrite’u. Najpierw zaprojektować bezpieczne przejście z freeze, poprawić kontrakt serializacji, ochronę wejścia builda i odporność cache. Przywracać dopiero tak zweryfikowane grupy testów, nie cały historyczny stos 25 workflow.

### 1.1 Co oznaczają kategorie i priorytety

`FACT` oznacza odczytany kod, konfigurację albo wykonany eksperyment. `INFERENCE` oznacza wniosek z tych faktów; podano pewność oraz ograniczenia. `RECOMMENDATION` jest propozycją, nie wykonaną zmianą. `UNKNOWN` oznacza brakujący dowód. Hipotetyczny model zagrożenia opisano wprost jako założenie.

`P1` oznacza problem do rozwiązania przed odpowiednią dostawą produktu lub użyciem niebezpiecznej operacji. `P2` oznacza ważną poprawkę spójności, odporności albo kontroli. `P3` oznacza zadanie niższego priorytetu lub zależne od zachowania utrzymywanego modułu. Te oznaczenia nie są CVSS i nie oznaczają automatycznie publicznie wykorzystywalnej podatności. Nie potwierdzono wykorzystania któregokolwiek problemu na produkcji.

## 2. Rzeczywiście wykonane badania

| Badanie | Wykonanie i wynik | Czego ten wynik nie dowodzi |
|---|---|---|
| Oryginalny `performance.test.mjs` | 4/4 PASS, bez pominięć | Nie jest to pełny zestaw testów runtime ani pomiar wydajności aplikacji |
| Dodatkowe kontrakty cache/schedulera | 3/3 PASS na niezmienionym kodzie | Nie naprawiają wykrytych błędów obsługi storage |
| Próby runtime i transportu | 27 prób: 11 spełniło zadaną własność, 16 wykazało rozbieżność, 0 błędów samej próby | Rozbieżności obejmują warianty tych samych przyczyn i obserwacje API; nie są 16 niezależnymi podatnościami |
| Serializacja między językami | 3 manifesty: 2 zaakceptowane, 1 odrzucony; dodatkowo 6 wektorów serializacji | Wektory liczb zmiennoprzecinkowych nie oznaczają, że każdy schemat publikacji dopuszcza takie wartości |
| Cały `compile_all()` na małych danych | 2 wykonania generatora; każde wytworzyło 1197 mini-shardów i 16 pięter | Nie używano rzeczywistego świata Game ani archiwum Tibia; nie wykonano wszystkich weryfikatorów FullWorld |
| Odbiór wyników tych buildów | Kontrola przeszła loadery publication/world/pixel; wariant z ID 2 i 10 poległ w pixel catalog | Nie jest to uruchomienie UI, renderera i wszystkich produktów pomocniczych |
| Kolizja katalogów builda | Odtworzono usunięcie 1197 tymczasowych shardów przed błędem odczytu | Usuwano wyłącznie dane utworzone przez audyt w `TemporaryDirectory` |
| Aliasowanie hardlinków | Potwierdzono wspólny inode i zmianę wejścia przez zapis do wyjścia | Hardlink nie jest sam w sobie błędem przy skutecznie wymuszonej niezmienności |
| Próba mutacyjna | Oryginalne 4 testy wykryły 1 z 4 celowych zmian; po dodaniu 3 kontraktów suma testów wykryła wszystkie 4 | To nie jest mutation score całego repozytorium |
| Odczyt framebuffer — fault injection | 2 kontrole poprawne; symulowany nieskuteczny odczyt potraktowany jako niepusty obraz | Użyto jawnego fake GL, nie rzeczywistego błędu sterownika |
| Próba prawdziwego WebGL | Nieuzyskana kwalifikacja: `WebGL2 unavailable`; wcześniej błąd administracyjnej blokady nawigacji HTTP | Nie oznacza awarii Atlasa na wspieranym runnerze |

Środowisko wykonania modułów: Node `v22.16.0`, Python dostępny w sandboxie. Nie jest to to samo środowisko co przypięty kontener Playwright CI. W eksperymentach nie przywrócono ani nie uruchomiono zawieszonych pipeline’ów GitHub Actions.

Źródła wyników: `original-performance-tests.tap`, `additional-contracts.tap`, `runtime-probes.json`, `cross-language.json`, `synthetic-build.json`, `synthetic-build-consumption.json`, `builder-safety.json`, `mutation-probes.json`, `framebuffer-fault.json`, `browser-renderer.json`.

### 2.1 Mapa pokrycia audytu

| Obszar | Głębokość badania |
|---|---|
| GitHub main i ochrona integracji | Bezpośredni odczyt main i rulesetu; wcześniejsze dowody runów MQ zachowano jako dowody konkretnego zdarzenia |
| Granica Game → Atlas | Kontrakty publikacji i rzeczywiste walidatory; brak ponownej kwalifikacji prawdziwego eksportu Game |
| Generator publikacji | Pełny plik, zgodność blob, dwa syntetyczne buildy, próba bezpieczeństwa ścieżek |
| Loadery manifestów, zakresów i pikseli | Pełne moduły użyte do wykonania; pozytywne i negatywne przypadki |
| Cache, SHA i stan URL | Wykonanie właściwych modułów, współbieżność, błędy, granice i wektory niezależne |
| WebGL i diagnostyka | Pełny kod renderera/probe; fault injection w CPU; brak skutecznej kwalifikacji GPU |
| Orkiestracja całej aplikacji | Prześledzone wskazane fragmenty boot/refresh/interaction/diagnostics; nie każda linia obu dużych modułów UI |
| Hunt Intelligence | Przejrzany konsument, walidacja i końcowy evaluator; brak aktywnej akceptacji funkcji w UI |
| Playwright i dostępność | Konfiguracja oraz wybrane scenariusze i oracles; nie cała macierz E2E |
| CI i procesy uprzywilejowane | Bieżąca topologia oraz przypięty reusable branch lifecycle; nie pełny audyt implementacji Platform |
| Prompty i instrukcje | Root authority, IA, canary i jego test; historyczny duży prompt zbadano przez wskazane fragmenty, nie wszystkie prompty słowo po słowie |
| Publikacja operacyjna, hosty i recovery | Kod/kontrakty i wcześniejszy run; bez odczytu obecnego kontenera, wolumenów i realnego restore |
| Licencje, sekrety, podatności zależności | Konfiguracja i deklaracje; brak pełnego skanu historii sekretów, SBOM i kompletnego odczytu security alerts |

## 3. Założenia i architektura — ocena granic odpowiedzialności

### 3.1 Co należy zachować

Atlas ma być pochodnym modelem odczytu: Game posiada fakty świata, Atlas indeksowanie, transport i prezentację. `src/publication/fullworld-v0.md` rozdziela logiczny adres od tożsamości bajtów. Pełne loadery porównują root własny, root oczekiwany oraz relacje między manifestami. Próby z niewłaściwym zaufanym rootem, uszkodzonym zakresem i błędnym `Content-Range` były odrzucane. To istotne zabezpieczenia, których nie należy usuwać przy upraszczaniu repozytorium. [S01, S02, S03, C01]

W kodzie istnieją rozdzielone pojęcia profilu weryfikacji i rodzaju wymaganych danych. Fixture nie powinien wymagać rzeczywistych kompletnych bajtów świata tylko dlatego, że zestaw funkcjonalny jest szeroki. Obecny `fullworld-trust.mjs` i boot warstwy stworzeń używają wspólnych oczekiwań źródłowych. Historyczne stwierdzenie, że ten boot wciąż bezwarunkowo wymaga produkcyjnej tożsamości, nie opisuje już badanego fragmentu current main. [C02, C03]

Podział transportu semantycznego, pikseli, cache i renderera jest zasadniczo sensowny. Wąskim gardłem utrzymywalności nie musi być brak frameworka. Bardziej namacalne są różne implementacje podobnych reguł: canonical JSON, bounded response, safe path, source expectations i obsługa błędów cache. Ich rozbieżności potwierdzono wykonaniem, a nie liczbą linii.

### 3.2 Łańcuch, który powinien być sprawdzany razem

```text
zaakceptowany eksport / fabric Game
  -> Python: publikacja i jej tożsamości
  -> indeksy runtime, produkty pikselowe i dane pomocnicze
  -> JS: zaufany manifest i zgodne reguły serializacji
  -> zakresy / cache / dekodowanie
  -> stan widoku i zatwierdzona scena
  -> renderer / interakcja / prezentacja
  -> niezależne sprawdzenie zachowania i obrazu
```

Sprawdzenie każdej warstwy jej własnym helperem nie wystarcza. Test napisany w JS i generujący oczekiwany manifest również w JS może nie wykryć, że prawdziwy producent Pythona serializuje inaczej. Test diagnostyki nie zastępuje sprawdzenia obrazu, a poprawny hash nie oznacza poprawnej semantyki tego, co hashowano. Są to różne własności, nie argument za rezygnacją z hashy.

### 3.3 Mapa stanu funkcjonalnego

| Funkcja | Stan potwierdzony w kodzie | Granica twierdzenia |
|---|---|---|
| Publikacja i strumieniowanie mapy | Istnieją producent, root linkage i range store; wykonane testy części tego toru | Nie potwierdzono kompletnej nowej publikacji rzeczywistego świata |
| Przeglądanie, piętra, URL | Istnieją parser, serializer i kontrolery; wykryto błąd graniczny | Nie wykonano bieżącego pełnego browser journey |
| Stworzenia, search i inspector | Boot jest trust-aware; są indeks, filtrowanie, interakcje i diagnostyka | To nie dowód końcowej jakości wszystkich kart i danych |
| Animacja | Boot pobiera programy; mapa obsługuje statyczny fallback przy błędzie animacji | Nie potwierdzono wizualnej zgodności ani wszystkich profili przeglądarek |
| Named semantic layers | Wiele pozycji pozostaje wyłączonych z jawnym BLOCKED/UNKNOWN | Wyłączona kontrolka nie jest ukończoną funkcją; nie należy zastępować brakujących danych zgadywaniem |
| Hunt recommendation | Końcowy evaluator zwraca brak kandydatów, także przy dostępnych zależnościach | Fundament kontraktów jest obecny, rekomender nie jest wykazaną działającą funkcją |
| Integracja PR/MQ | Działa tryb maintenance; wymagany check ma ścieżkę PR i MQ | Sukces maintenance nie kwalifikuje produktu |

## 4. D01 — niezgodna kanonizacja Python–JavaScript

**Priorytet: P1. Status: FACT — odtworzony błąd między producentem a konsumentem.**

**Miejsca:** `tools/fullworld-publication/publication.py:25–35, 123–153`; `src/browser/loader.mjs:9–22`; `src/browser/fullworld-pixels.mjs:27–59`. [S04, S03, S02]

Python używa `json.dumps(..., sort_keys=True)`. JS najpierw wpisuje posortowane klucze do zwykłego obiektu, a potem wykonuje `JSON.stringify`. Dla kluczy będących indeksami liczbowymi rezultat nie zachowuje tego samego porządku. Potwierdzony przykład:

```text
Python:     {"spriteIndex":{"10":0,"2":0}}\n
JavaScript: {"spriteIndex":{"2":0,"10":0}}\n
```

To dotyczy struktury rzeczywiście używanej przez publikację, ponieważ `publish_pixels()` tworzy `spriteIndex[str(sid)]`.

### 4.1 Reprodukcja i kontrole

Najpierw wytworzono trzy syntetyczne manifesty z użyciem oryginalnych funkcji `canonical`, `rooted` i `pixel_id`. Jeden ID `2` przeszedł. ID `11` i `12` przeszły. ID `2` i `10` zostały odrzucone przez oryginalny `loadFullWorldPixelCatalog` z komunikatem `pixel manifest is not canonical JSON`.

Następnie powtórzono problem bez ręcznego składania docelowego manifestu: wykonano całe `compile_all()` na dwóch małych zestawach. Każdy zawierał 1197 mini-shardów, 16 pięter, własne syntetyczne rekordy i samodzielnie wygenerowane piksele. Przypięte tożsamości, źródłowe deklaracje i plik o oczekiwanej nazwie attestation były jawnie oznaczonymi elementami testowymi, nie prawdziwym eksportem ani rzeczywistą zgodą na assety Tibia. Nie zmieniano modułu generatora.

Oba buildy się zakończyły. Oba wyniki przeszły właściwy loader top-level publication i semantic world. Kontrola `11/12` przeszła też pixel catalog; wariant `2/10` ponownie poległ w tym samym miejscu. Surowe dane: `synthetic-build*.json`, `cross-language.json`.

### 4.2 Znaczenie i ograniczenia

**INFERENCE — pewność wysoka.** To rzeczywista niespójność dostępnych implementacji kontraktu. Zmiana zestawu identyfikatorów może spowodować odrzucenie produktu, mimo że producent zakończył pracę poprawnie według własnych reguł. Nie twierdzę, że aktualnie serwowany FullWorld zawiera właśnie taki konflikt, ani że odtworzono jego kompletny build i wszystkie etapy możliwego post-processingu.

Test repozytoryjny w `runtime.test.mjs` tworzy przykładowy pixel manifest po stronie JS i używa pojedynczego klucza sprite’a. Ten konkretny przykład nie sprawdza niezgodności z realnym serializerem Pythona. Nie jest to dowód braku wszystkich innych testów między językami. [C04]

### 4.3 Naprawa i kryterium akceptacji

**RECOMMENDATION.** Przyjąć jeden jawny kontrakt canonical JSON, z ustalonym porządkiem nazw, reprezentacją liczb, dozwolonymi typami i zachowaniem dla błędnych wartości. Można wykorzystać JCS jako punkt odniesienia, ale obecnej implementacji nie należy nazywać zgodną z RFC 8785 bez odpowiednich testów. [W01]

Nie wystarczy zmienić jednego helpera i przepiąć hashów. Zmiana canonical bytes wpływa na rooty i kompatybilność wcześniej opublikowanych produktów. Potrzebna jest kontrolowana migracja wersji/formy danych, z rozdzieleniem historycznych i nowych tożsamości.

Akceptacja: wspólny korpus wektorów Python→JS oraz JS→Python; numeric keys o różnej długości; dozwolone liczby i Unicode; odrzucenie nieprawidłowych wartości; build producenta odczytany przez rzeczywisty konsument; zachowanie negative tamper controls. Porównanie dwóch rezultatów tego samego błędnego helpera nie spełnia kryterium.

## 5. D02 — generator usuwa wejście przy kolizji `--output`

**Priorytet: P1 dla operacji build/publikacja. Status: FACT — odtworzony efekt destrukcyjny na danych tymczasowych.**

**Miejsce:** `tools/fullworld-publication/publication.py:155–158`. Po sprawdzeniu handoffu `compile_all()` wykonuje `shutil.rmtree(out)`, gdy katalog wyjściowy istnieje. Nie ma wcześniejszego sprawdzenia relacji wyjścia do źródłowego fabric, repo-root ani innych wejść. [S04]

### 5.1 Reprodukcja

Utworzono w `TemporaryDirectory` kopię kompletnego małego fabric z wcześniejszego syntetycznego builda oraz plik kontrolny. Następnie wywołano oryginalną funkcję z tym samym katalogiem jako `fabric` i `out`. Handoff miał prawidłowy digest dla danych testowych.

```text
początkowa liczba shardów: 1197
pozostała liczba shardów: 0
plik kontrolny przetrwał: false
wynik: FileNotFoundError przy próbie odczytu shard-0000/tiles.jsonl
```

Usunięcie nastąpiło przed błędem builda. Nie dotknięto repozytorium, źródeł świata ani żadnego hosta użytkownika. Wynik: `builder-safety.json`.

### 5.2 Znaczenie

To nie jest twierdzenie o zdalnej podatności. Jest to brak zabezpieczenia operacji narzędziowej: omyłkowe argumenty lub wadliwa konfiguracja joba mogą zniszczyć wejścia przed zgłoszeniem błędu. Sam wymóg poprawnego handoff SHA nie zabezpiecza relacji katalogów. Nie sprawdzono, czy wszystkie aktualne, zawieszone wrappery uniemożliwiają taki układ argumentów; one mogą ograniczać ryzyko konkretnego wywołania, ale nie naprawiają publicznego API/CLI narzędzia.

### 5.3 Naprawa

**RECOMMENDATION.** Przed jakimkolwiek usuwaniem rozwiązać ścieżki i sprawdzić tożsamość oraz relacje przodek–potomek. Odrzucić wyjście równe wejściu, zawierające wejście i inne zabronione nakładanie. Uwzględnić aliasy przez symlinki i istniejące inode’y, a nie tylko tekst ścieżki.

Budować do świeżego katalogu staging. Dopiero po poprawnym zakończeniu i weryfikacji publikować wynik atomowo, z rozróżnieniem błędu builda od błędu promocji. Kryterium testowe: każdy błędny układ katalogów pozostawia wejścia bajtowo nienaruszone, a błąd builda nie usuwa poprzedniej zaakceptowanej publikacji. Testować wyłącznie na katalogach tymczasowych.

## 6. D03 — pomocniczy cache staje się warunkiem poprawności runtime

**Priorytet: P1 dla odporności ścieżki odczytu. Status: FACT na poziomie rzeczywistych modułów; wystąpienie na produkcji UNKNOWN.**

**Miejsca:** `verified-content-cache.mjs:20–46`; `fullworld.mjs:451–473`; analogiczny zapis w `fullworld-pixels.mjs:101–113`. Boot mapy tworzy `VerifiedContentCache({enabled:true,...})` i przekazuje go do loaderów. [S05, S01, S02, C05]

Próba `cache-quota-load` pobrała prawidłowy zakres o długości 176 bajtów, z poprawnym `Content-Range` i zgodnym digestem. Wstrzyknięto wyłącznie błąd storage podczas `put`: `QuotaExceededError`. `loadGroup()` odrzucił obietnicę, a poprawne kafle nie zostały zwrócone. W próbie `cache-unavailable-load` błąd `open()` zatrzymał ładowanie jeszcze przed pierwszym żądaniem sieciowym.

`QuotaExceededError` nie jest arbitralnie wymyśloną kategorią: specyfikacja storage/cache przewiduje taki błąd przy przekroczeniu limitu zapisu. Nie oznacza to, że zmierzono zapełnienie konkretnej przeglądarki użytkownika. [W02]

**INFERENCE — pewność wysoka.** Mechanizm optymalizujący odczyt może unieruchomić poprawną ścieżkę danych. Z kodu aplikacji wynika, że błędy boot/refresh są propagowane do obsługi failure; dokładnego rezultatu wizualnego tej sytuacji nie zakwalifikowano w natywnym E2E.

**RECOMMENDATION.** Oddzielić błędy walidacji treści od błędów pamięci pomocniczej. Błąd quota/availability powinien wyłączyć lub ominąć cache, pozostawiając loaderowi możliwość użycia prawidłowych, zweryfikowanych bajtów. Nie wolno przez szeroki `catch` ukryć niewłaściwego hasha odpowiedzi sieciowej. Uszkodzony wpis cache należy odrzucić i pobrać źródło ponownie pod tym samym zaufanym kontraktem.

Akceptacja: awaria `open`, `match`, `put` i `delete`; wyczerpanie quota; brak API cache; uszkodzenie wpisu; poprawny fallback do sieci; ciągłe odrzucanie uszkodzonych bajtów. Status diagnostyczny powinien mówić „cache niedostępny”, a nie „produkt niezgodny”.

## 7. D04 — współbieżność psuje księgowanie cache

**Priorytet: P2. Status: FACT — odtworzone.**

**Miejsce:** `SemanticRangeStore.remember()` i `loadGroup()`, `fullworld.mjs:440–475`. [S01]

Dwa równoległe odczyty tego samego klucza oba ominęły jeszcze pusty cache i wykonały dwa żądania. Po zakończeniu w mapie pozostawał jeden wpis, ale `cacheBytes` wzrosło dwukrotnie:

```text
unikalna treść rezydentna: 176 B
cachedGroups: 1
cacheBytes: 352 B
rangeRequests: 2
```

Przyczyną błędnego licznika jest bezwarunkowe dodawanie `group.bytes` po `Map.set()` również wtedy, gdy wpis dla tego klucza już istnieje. Brakuje też koaleskowania żądań in-flight. Wynik: `runtime-probes.json`, `cache-parallel-same-group`.

**Znaczenie:** dodatkowe pobieranie/hashing i nieprawdziwa podstawa dla polityki eviction oraz diagnostyki. Nie wykazano, że rzeczywisty heap podwoił się; przeciwnie, pomiar ujawnia różnicę między unikalną zawartością mapy a licznikiem. Nie należy nazywać tego automatycznie wyciekiem pamięci.

**RECOMMENDATION.** Przy zastępowaniu wpisu odejmować poprzedni wkład albo nie dodawać ponownie identycznego wpisu. Koaleskować ten sam niezmienny zasób przez wspólną obietnicę. Poprawnie usuwać zakończone lub odrzucone wpisy in-flight. Uważać na anulowanie: sygnał jednego konsumenta nie może bez uzgodnienia przerwać odczytu potrzebnego innemu.

Akceptacja: dwa i wiele równoległych odczytów; awaria jednego pobrania; retry po błędzie jako nowe jawne żądanie; eviction; licznik równy sumie unikalnych wpisów. Równoległość ma zmieniać koszty, nie wynik i nie tożsamość treści.

### 7.1 Osobna obserwacja: clear podczas odczytu

Wywołanie `clearForFloorChange()` nie zapobiegło ponownemu wpisaniu starego wyniku przez rozpoczęty wcześniej odczyt. To potwierdzona własność API. Aplikacja posiada jednak osobne epoch/floor/view guards po await. Nie wykazano, że stara scena zostaje pokazana. Najpierw należy zdecydować, czy `clear` ma gwarantować opróżnienie po zakończeniu wcześniejszych żądań, czy wyłącznie wyczyścić stan w chwili wywołania. Dopiero wtedy dodawać test kontraktu i ewentualny generation token. [C05]

## 8. D05 — limity odpowiedzi są egzekwowane za późno

**Priorytet: P2. Status: FACT — wcześniejsze ustalenie statyczne potwierdzono wykonaniem.**

**Miejsca:** `loader.mjs:117–123`, `fullworld.mjs:51–58`, `fullworld-pixels.mjs:33–40`; podobny wzorzec w `web/fullworld-creatures.mjs::boundedJson`. [S03, S01, S02, C03]

Czytnik sprawdza deklarowany `Content-Length`, wykonuje `arrayBuffer()`, a potem porównuje długość rzeczywistą. W próbie strumień bez tego nagłówka dostarczył osiem porcji po 128 KiB. Wszystkie zostały skonsumowane — łącznie 1 MiB — zanim zadziałał limit manifestu wynoszący 256 KiB. `cancelled` pozostało `false`.

To poprawne odrzucenie nadmiernego dokumentu na etapie akceptacji, ale nie skuteczna ochrona kosztu pobierania i buforowania. Nie wykonywano OOM ani przeciążania hosta; wynik dotyczy niewielkiego lokalnego strumienia zliczanego w harnessie.

**RECOMMENDATION.** Wspólny, ograniczony czytnik strumieniowy. Liczyć dostarczone bajty, przerwać czytanie po przekroczeniu limitu, zachować dokładną walidację rozmiaru z manifestu oraz digest. `Content-Length` traktować jako pomocniczą przesłankę, nie jedyną ochronę. Przenieść tę samą regułę do wszystkich loaderów zamiast naprawiać po jednym skopiowanym wariancie.

Akceptacja: brak nagłówka, zaniżony nagłówek, dokładny limit, limit+1, body przerwane w połowie, błędny UTF-8, zewnętrzny abort. To w większości tanie testy bez browser E2E i bez FullWorld.

## 9. D06 — parser akceptuje współrzędną, której nie umie zapisać serializer

**Priorytet: P2. Status: FACT — odtworzony błąd half-open bounds.**

**Miejsca:** `fullworld.mjs:519–523, 555–618`; odpowiednik w `semantic.mjs:30–33, 145–166`. [S01, S06]

Kontrola `value < maxExclusive` następuje przed zaokrągleniem. Dla granic `[0,10)` wartość `9.99999` przechodzi kontrolę, po czym zaokrągla się do `10`. Otrzymany stan jest poza dopuszczalnym obszarem. `serializeFullWorldViewState()` odrzuca właśnie ten stan: `x is outside exported floor bounds`.

Odtworzono również odpowiednik w starszym proof: `32440.99999` zostaje zamienione na `32441`, a ponowna serializacja nie przechodzi. Zwykły round-trip wewnątrz granic przeszedł jako kontrola.

**Znaczenie:** niespójny kontrakt podstawowego stanu nawigacji. Nie jest to tylko różnica zapisu liczby. Aplikacja używa parsera i serializera w boot oraz zmianach widoku, ale końcowego efektu na ekranie nie zmierzono. Oddzielne clampy w części interakcji mogą ograniczać zasięg; nie usuwają błędu publicznej funkcji.

**RECOMMENDATION.** Najpierw określić reprezentowalny zbiór współrzędnych przy danej precyzji. Następnie sprawdzać stan po normalizacji albo ograniczać go do ostatniej reprezentowalnej wartości poniżej granicy. Nie zmieniać `maxExclusive` na granicę domkniętą tylko po to, żeby test przeszedł.

Akceptacja: property `parse(serialize(parse(input)))` dla każdego zaakceptowanego wejścia; dolne i górne granice, wartości ujemne, liczby o wielu miejscach dziesiętnych, zmiana piętra i różne zakresy. Używać niezależnego oczekiwania dla granic, nie wyłącznie wzajemnie zgodnych parsera i serializera.

## 10. D07 — walidacja ścieżki nie uwzględnia normalizacji URL

**Priorytet: P2 hardening. Status: FACT dla funkcji; brak dowodu zdalnego wykorzystania.**

**Miejsce:** `fullworld.mjs:30–35` i wywołania `new URL(...)`. [S01]

`safeRelativePath()` odrzuca literalne `..`, backslash, pusty segment i początkowy slash. Akceptuje jednak procentowo zakodowane segmenty nadrzędne oraz niektóre znaki sterujące, które parser URL później normalizuje.

| Przypadek przy bazie `https://audit.invalid/semantic/` | Wynik |
|---|---|
| `chunks/floor.json` | Poprawnie pozostaje w katalogu publikacji |
| `../outside.json` | Poprawnie odrzucone |
| `%2e%2e/outside.json` | Zaakceptowane; cel `/outside.json` poza `/semantic/` |
| `chunks/%2e%2e/%2e%2e/outside.json` | Zaakceptowane; ten sam problem |
| Tabulator przed `/outside.json` | Zaakceptowane; po normalizacji ścieżka wychodzi poza prefiks |
| `https:other.invalid/file` | W tej próbie NIE wyszło na inny origin; nie raportuję tego jako cross-origin bypass |

Nie wykazano obejścia zaufanego rootu, odczytu plików hosta ani publicznego SSRF. Zaufane manifesty i ich hashe są ważnym zabezpieczeniem kompensującym. Problemem jest niespełniona własność samego walidatora: dopuszczona ścieżka nie musi pozostawać w zadanej przestrzeni nazw.

**RECOMMENDATION.** Walidować składnię i rozwiązany URL: zgodny origin, dozwolony schemat, brak credentials, ograniczenia query/fragment oraz rzeczywisty prefiks ścieżki z granicą segmentu. Od razu odrzucać znaki sterujące. Reguły procentowego kodowania muszą być spójne z rzeczywistym parserem. Nie zastępować tego nieprecyzyjnym `startsWith('/data')`, który dopuści także `/data-other`.

## 11. D08 — oracle geometrii przepuszcza `NaN`

**Priorytet: P2 dla niezależności weryfikacji. Status: FACT; obecny producent diagnostyki ma zabezpieczenie kompensujące.**

**Miejsce:** `e2e/support/geometry-oracle.mjs:30–50,55–75`. [S07]

Wartości wejściowego transformu są sprawdzane, ale rzeczywiste `anchor.screenX/screenY` nie mają analogicznej kontroli przed obliczeniem odchylenia. `NaN` przenosi się przez `Math.hypot()` i `Math.max()`. Warunek `maxDriftPx > tolerancePx` nie zgłasza wtedy przekroczenia.

Odtworzono przyjęcie niepełnej współrzędnej oraz `NaN`. Co ważniejsze, jeden taki anchor spowodował zaakceptowanie zestawu, w którym drugi anchor miał odchylenie 100 px. `analyzeGeometryEventLog()` zwrócił sprawdzony wpis bez mismatchów. Poprawny zestaw przeszedł, a skończone odchylenie 20 px i Infinity zostały odrzucone — to kontrole ograniczające ryzyko błędu samego eksperymentu.

**Zabezpieczenie kompensujące:** `createCreatureRenderSnapshot()` w `src/browser/creature-render-diagnostics.mjs` wymaga skończonych `screenX/screenY`. Normalny przejrzany producent nie powinien więc wytwarzać takich anchorów. Nie wykazano aktualnego błędu renderowania, który przeszedł pełny tor testu. [C06]

**RECOMMENDATION.** Oracle musi sam odrzucać nieprawidłowe pomiary. Nie powinien ufać walidacji kodu, którego wynik ma niezależnie oceniać. Walidować też dodatnie DPR/skale, sensowne wymiary, generacje i niepusty zestaw pomiarów tam, gdzie test tego wymaga. Akceptacja obejmuje malformed snapshot, brak wartości, `NaN`, nieprawidłową generację i mieszany zestaw poprawnych/błędnych pomiarów.

## 12. D09 — nieudany odczyt pikseli może wyglądać jak niepusty obraz

**Priorytet: P2 jako luka w kontrakcie dowodu. Status: FACT w fault injection; rzeczywisty błąd GPU UNKNOWN.**

**Miejsca:** `framebuffer-probe.mjs:20–42,62–85`; `fullworld-webgl.mjs:63–74`. [S08, S09]

Probe tworzy zero-inicjalizowany bufor, wywołuje `readPixels` i porównuje wynik z kolorem czyszczenia `[7,11,17,255]`. Nie ma w tym torze sprawdzenia powodzenia odczytu. Wstrzyknięta operacja, która nie zapisuje bufora, pozostawiła `[0,0,0,0]`. Funkcja uznała wszystkie dziewięć próbek za różne od koloru tła i zwróciła `blank:false`.

To nie jest wykonana awaria sterownika. Harness jawnie używał fake GL. Próba natywnego renderera w tym środowisku nie dała kontekstu WebGL2, dlatego z jej wyniku nie wolno wyciągać twierdzenia o obecnej przeglądarce użytkownika.

**RECOMMENDATION.** Oddzielić „odczyt poprawny i obraz niepusty” od „brak wiarygodnego odczytu”. Na zatwierdzonym browser runnerze sprawdzić utratę kontekstu i błędy odczytu, ich wykrywanie, brak nieprawdziwego PASS oraz ewentualne odtwarzanie. Zwykły niezerowy licznik draw calls także nie dowodzi, że wykonano poprawny rendering.

## 13. D10 — niepełna walidacja semantyki mimo poprawnej tożsamości

### 13.1 Powtórzone piętra w runtime world

**Priorytet: P2. Status: FACT na kontrakcie loadera.** `loadRuntimeWorld()` wymaga tablicy długości 16, ale w badanej funkcji nie sprawdza unikalności pięter. Manifest z 16 wpisami tego samego piętra został zaakceptowany po prawidłowym obliczeniu i jawnym wskazaniu jego testowego trusted root. `uniqueFloors` wynosiło 1. [S01:131–144]

Nie jest to możliwość podmienienia dowolnego produkcyjnego manifestu bez zmiany pinu. Eksperyment świadomie ustanawiał zaufaną tożsamość wadliwego dokumentu. Ujawnia, że trusted bytes i poprawny schemat to odrębne warstwy: walidator kontraktu nie wyklucza tej wadliwości.

**RECOMMENDATION.** Sprawdzać unikalność, dozwolony zbiór pięter, powiązanie liczników i bounds. Zachować niezależny test błędnego rootu, który w audycie był poprawnie odrzucany. Nie wprowadzać dowolnego zakresu pięter wbrew kanonicznemu kontraktowi Game.

### 13.2 Ułamkowe współrzędne faktu w starszym proof

**Priorytet: P3, zależnie od utrzymywania proof. Status: FACT.** `semantic.mjs::decodeCompactTile()` przyjmuje ułamkowe X/Y, używając helpera przeznaczonego dla widoku zamiast helpera liczb całkowitych. W próbie przyjął `.5` na obu osiach. Zmienne po normalizacji są dodatkowo wyliczane, ale zwracane są oryginalne X/Y. [S06:88–99]

Pełny runtime używa innego dekodera, który sprawdza safe integers. Nie rozszerzam tego ustalenia na całą mapę. Należy rozdzielić ciągłe współrzędne kamery od dyskretnej pozycji kafla i ustalić, czy stary proof pozostaje kontraktem utrzymywanym, czy materiałem historycznym.

## 14. D11 — canonicalizer pomija własne pole `__proto__`

**Priorytet: P2 hardening; rozwiązywać razem z D01. Status: FACT.**

`sortCanonical()` buduje zwykły obiekt `{}`. Dla obiektu uzyskanego przez `JSON.parse` z własnym kluczem `__proto__` przypisanie nie zachowuje tego klucza jak zwykłej własności. W próbie wejście z `a` i `__proto__` dało canonical bytes zawierające wyłącznie `a`. [S03:9–22]

Nie wykazano globalnego prototype pollution, złamania SHA-256 ani eksploatacji w produkcji. W pełnym loaderze kontrola zgodności canonical bytes z surowymi bajtami może odrzucić taki manifest. Starszy loader stosuje inny zakres kontroli. Problem dotyczy deklarowanej kompletności reprezentacji danych przed hashowaniem.

**RECOMMENDATION.** Stosować bezpieczny model obiektu lub serializer zapisujący jawnie klucze zgodnie ze specyfikacją. Zdefiniować dozwolone/zakazane nazwy w odpowiednich schematach. Testować brak cichej utraty pól. Nie naprawiać tego samym blacklistowaniem jednego przykładu, pomijając ogólny kontrakt serializacji.

## 15. D12 — niejednakowy łańcuch zaufania danych pomocniczych

**Priorytet: P1 do rozstrzygnięcia modelu zaufania przed publikacją; nie jest to potwierdzony exploit. Status: analiza kodu.**

W przejrzanym `boot()` warstwy stworzeń top-level `data/creatures/index.json` jest pobierany przez `boundedJson` bez oczekiwanego digestu samych bajtów indeksu. Następnie sprawdzane są zadeklarowane źródło, capability, semantic digest, fixture identity i rooty produktów animacji. Hashe dzieci pochodzą z właśnie pobranego indeksu. [C03:1010–koniec]

To różni się od toru mapy, gdzie manifest jest powiązany z niezależnie oczekiwanym rootem. Porównanie `index.source.semantic_digest` z wartością oczekiwaną potwierdza zgodność pola deklaracji. Samo nie oblicza, że wszystkie pozycje i deskryptory w tym indeksie rzeczywiście pochodzą z tych bajtów źródłowych.

**ASSUMPTION dla oceny ryzyka:** podmiot lub błąd operacyjny potrafi zmienić wyłącznie publikowane dane pomocnicze, nie kod JS i nie jego zaufane piny. To węższy model niż przejęcie całego originu. **INFERENCE — pewność umiarkowana co do zagrożenia wdrożenia, wysoka co do widocznego przepływu:** przy takim modelu spójnie podmieniony indeks i jego dzieci mogą wymagać silniejszego powiązania niż zachowanie oczekiwanych pól source. Nie wykonano pełnego scenariusza podmiany, nie zbadano wszystkich zabezpieczeń publishera i dostępu do wolumenu.

**RECOMMENDATION.** Ustalić jeden kontrakt: albo zaufany manifest wydania obejmuje hashe danych pomocniczych, albo ich granica zaufania jest jawnie oparta o inne, zweryfikowane zabezpieczenie. Preferowane jest związanie indeksu z zaakceptowaną publikacją. Dodać test zmiany dziecka wraz z hashem dziecka w indeksie, przy niezmienionych deklaracjach source. Takiej zmiany nie wolno akceptować wyłącznie dlatego, że deklaracje się zgadzają.

Nie kopiować bezrefleksyjnie tej diagnozy na wszystkie walidatory: np. konsument Hunt oczekuje od caller’a już niezależnie zweryfikowanego digestu. Tam trzeba zbadać caller, a nie zarzucać czystemu walidatorowi brak własnego pobierania i hashowania. [C07]

## 16. D13 — hardlinki i niezmienność publikacji

**Priorytet: P2 warunkowo. Status: potwierdzona własność implementacji, nie samodzielny błąd.**

`link_or_copy()` najpierw próbuje `os.link`. W próbie wyjście i wejście miały ten sam inode. Zapis do pliku wyjściowego zmienił plik wejściowy. [S04:49–52; `builder-safety.json`]

To może być uzasadniona optymalizacja kopiowania dużej publikacji. Wymaga jednak rzeczywistej niezmienności obu powierzchni. Nazwa content-addressed i zapisany hash nie czynią inode’u niezmiennym. Nie sprawdzono aktualnych uprawnień mountów, snapshotów ani polityk zapisu na serwerze.

**RECOMMENDATION.** Wymuszać read-only/snapshot dla źródeł oraz zweryfikowanych produktów; nie przetwarzać wyjścia in-place. Tam, gdzie odseparowane zapisy są potrzebne, użyć kopii lub bezpiecznego mechanizmu copy-on-write. Nie zalecam automatycznego kopiowania całego wielkiego świata tylko z powodu obecności hardlinka. Decyzja zależy od zmierzonego kosztu i sprawdzonej granicy mutacji.

## 17. Testy: skuteczność, niezależność i koszt

### 17.1 Co pokazała próba mutacyjna

Eksperyment dotyczył wyłącznie `tests/fullworld-runtime/performance.test.mjs`. Dla każdej mutacji tworzono nową tymczasową kopię zweryfikowanych źródeł. Nie zmieniano źródeł bazowych ani GitHub.

| Celowa zmiana | Czy wykryły ją 4 oryginalne testy? | Czy wykryła ją suma oryginalnych i 3 dodatkowych? |
|---|---|---|
| Usunięcie weryfikacji digestu przy odczycie cache | Tak | Tak |
| Usunięcie odrzucenia błędnego digestu przy `put` | Nie | Tak |
| Usunięcie limitu wielkości wpisu | Nie | Tak |
| Usunięcie działania `cancel()` schedulera | Nie | Tak |

**INFERENCE — pewność wysoka dla tego pliku.** Zielony wynik tej grupy nie jest szerokim dowodem ochrony cache i schedulera. Test ochrony odczytu jest wartościowy i wykrywa celowy błąd. Brakujące trzy przypadki są tanie i nie wymagają przeglądarki. Inne pliki repozytorium mogą obejmować część tych zachowań; nie podaję globalnego współczynnika mutation coverage.

Dodatkowe testy są w pakiecie jako propozycja sprawdzalnych kontraktów, nie jako zmiana już dostarczona do repozytorium. Wyniki nie uprawniają do stwierdzenia, że naprawiono cache, ponieważ błędy quota i współbieżności nadal odtwarzają się na badanym main.

### 17.2 Właściwy podział sprawdzanych własności

Zachować niezależne sprawdzanie rootów, digestów, byte range i poprawności schematów. Dodać oddzielnie zgodność między językami, poprawność księgowania zasobów oraz odporność na błędy infrastruktury pomocniczej. Nie zastępować ich screenshotami.

Dla geometrii warto łączyć niezależną matematykę z obserwacją prezentacji. Obecne sprawdzanie generacji i transformacji jest użyteczne, ale nie widzi automatycznie błędnego wyniku GPU. Próbki framebuffer też mają wąski zakres: niepusty obraz nie dowodzi poprawnego sprite’a, kompletności sceny, czytelności etykiety ani hit targetu. [S07–S09; C08]

Testy zawierające warunkowe wykonanie obowiązku, np. sprawdzenie zmiany piętra tylko gdy przycisk jest aktywny, wymagają jawnego precondition albo osobnego statusu braku możliwości sprawdzenia. W przeciwnym razie wykonanie nie obejmuje deklarowanej własności. To nie powód, aby każdy brakujący opcjonalny element produktu traktować jako FAIL; trzeba rozróżnić opcjonalność funkcji od niezbędnego warunku danego testu.

### 17.3 Zalecana struktura kosztu

| Warstwa | Przykładowe własności | Typ danych |
|---|---|---|
| Szybka deterministyczna | canonical JSON, URL, cache, schemat, selekcja i tożsamości | Własne małe fixture’y |
| Integracja producent–konsument | Python output odczytany przez produkcyjne loadery JS | Mała kompletna strukturalnie publikacja |
| Funkcjonalne browser E2E | boot, navigation, search, cards, history, keyboard/touch, fault paths | Najmniejszy właściwy qualification world |
| Zgodność źródła | Własności zależne od konkretnych zaakceptowanych bajtów Game | Bounded real-world |
| Akceptacja skali i wydania | Pełny census, generacja całego produktu, skala i soak | Real FullWorld tylko gdy oracle tego wymaga |

Nie wykazano, że konkretny licznik workerów albo liczba shardów są optymalne. Nie wyliczono kosztu miesięcznego. Do takiej decyzji potrzebne są dane o kolejce, cold start, image extraction, budowaniu, transferze, czasie testów i p95 całej integracji — dla tego samego zakresu i środowiska. Sam czas czterech testów w sandboxie nie jest benchmarkiem CI.

## 18. Renderer, wydajność i UX — ocena bez nieuprawnionego PASS

Pełny przejrzany renderer rezerwuje texture array według liczby bajtów całego runtime pixel catalog. Pobieranie bucketów może być selektywne, ale rezerwacja przestrzeni GPU nie wynika wyłącznie z bieżącego viewportu. `reference` ma limit 384 MiB, `local-max` 768 MiB; `auto` wybiera obecnie `reference`, nie wariant globalnego uploadu. To rozróżnienie implementacja i testy profili rzeczywiście zachowują. [S09, S10, S11]

**INFERENCE — pewność wysoka co do konstrukcji, nie co do realnej szybkości.** Jeden draw call jest osiągany kosztem określonego modelu alokacji. Nie powinien być jedynym celem optymalizacji. Dla użytkownika istotne są także czas do pierwszej użytecznej sceny, responsywność, pamięć i zachowanie na urządzeniu z małą dostępną pulą GPU. Brak pomiarów nie pozwala powiedzieć, że obecna rezerwacja jest za duża dla rzeczywistych wspieranych urządzeń.

W przejrzanym rendererze nie ma pełnego kontraktu dispose/recovery, a zapytania timer query są odkładane do listy oczekujących do czasu dostępności wyniku. Wpływ długotrwałego braku odpowiedzi timera, utraty kontekstu lub błędów alokacji nie został zmierzony. Są to konkretne zadania do natywnej kwalifikacji, nie zgłoszone jako odtworzone wycieki lub awarie.

Aplikacja rozdziela raportowaną alokację GPU od nieznanej rzeczywistej pamięci rezydentnej. Zachowanie `null/N/A` dla nieobserwowalnych metryk jest dobre; nie należy zastępować go zgadywanymi wynikami FPS lub SLO. [C05]

Dostępność: przejrzane testy obejmują część nazw, enabled/disabled, Tab i aktywację klawiaturą. Nie sprawdzono pełnej nawigacji czytnikiem ekranu, kontrastu wszystkich stanów, powiększenia tekstu, reduced motion ani obecnej kompletnej obsługi dotykowej. Chromium z małym viewportem nie jest dowodem zgodności Safari iOS. Rekomendacja macierzy powinna wynikać z deklarowanej listy obsługiwanych przeglądarek, której bieżącej akceptacji nie ustalono. [C09, C10]

## 19. Cele produktu a implementacja: Hunt Intelligence

**FACT.** Konsument Hunt ma rozbudowane reguły: wersje, scope świata, klasy zaufania, jakość danych, kompletność, okna czasowe i jawne stany niedostępności. To użyteczna infrastruktura kontraktowa. Jednocześnie `evaluateHuntRecommendation()` po sprawdzeniu wejścia zwraca pustą listę kandydatów: przy braku gotowości odpowiedni stan, a przy `AVAILABLE` stan `INSUFFICIENT`. [C07]

**INFERENCE — pewność wysoka dla tej funkcji.** Nie jest to dowód ukończonego algorytmu rekomendacji. Oddzielić gotowość zależności, implementację kontraktu i działającą funkcję użytkową. Nie przedstawiać liczby plików/testów jako procentu ukończenia Hunt Intelligence. Nie stwierdzono, że produkt obiecuje dziś użytkownikowi wynik tego rekomendera ani że żaden inny moduł nie realizuje odrębnej funkcji farm exploration.

**RECOMMENDATION.** Kryteria końcowe powinny wskazywać przynajmniej jeden kompletny scenariusz, który na zaakceptowanych danych zwraca sprawdzalny wynik, oraz scenariusze niedostatecznej jakości, niezgodnego świata i danych niepublikowalnych. Utrzymać rozdzielenie MEASURED/ESTIMATE/UNKNOWN; nie wypełniać luk fikcyjnymi metrykami lub rankingiem.

## 20. Integracja, CI i nieoczywiste pliki sterujące

### 20.1 Stan bieżący

Końcowy odczyt rulesetu `22103758` wymaga `Merge authority audit / protected-base validate` z App 15368 oraz Merge Queue. Wymaganych approvali jest zero, CODEOWNERS review nie jest wymuszone, a właściciel ma możliwość bypassu ograniczoną do PR. To konfiguracja, nie dowód użycia bypassu podczas tego audytu. [G02]

Maintenance jest celowym wyłączeniem dawnych testów, a nie zwykłym „zielonym CI produktu”. Obecność trzech workflow i wcześniejszy udany run MQ kwalifikują określony zakres zmian maintenance. Nie wolno przenosić tego PASS na nieuruchomiony build czy E2E. Również brak klasycznego branch protection w odpowiedzi branch API nie oznacza braku ochrony, gdy działają rulesety.

### 20.2 „Dokumentacja” zawiera aktywne sterowanie

`docs/agents/BRANCH_LIFECYCLE_POLICY.json` jest odczytywany przez aktywny `terminal-branch-lifecycle.yml`. Przypięty workflow Platform `e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db` ma ścieżki z `contents:write`; domyślny `TERMINAL_BRANCH_DELETION_APPROVAL.json` służy do zastosowania zatwierdzonego manifestu. [C11–C13]

W reusable istnieją zabezpieczenia: kontrola dozwolonej operacji, warunki zdarzenia/ref, rozdzielenie odczytu i zapisu, ponowne zbudowanie zbioru kandydatów oraz walidacja manifestu approval. Nie stwierdzono arbitralnego wykonywania kodu z takiego JSON ani obejścia usuwania chronionej gałęzi. Implementacji wszystkich przywołanych skryptów Python Platform nie przeaudytowano w całości.

**RECOMMENDATION.** Klasyfikować zmiany według ich konsumenta i uprawnień, nie wyłącznie katalogu `docs/`. Dokument opisowy, cache zadania, polityka branch lifecycle i approval wykonawczy nie są tą samą klasą ryzyka. Tego rozróżnienia nie należy realizować drugim mutowalnym rejestrem otwartych Issues. Wystarczy wąski kontrakt istniejących powierzchni sterujących i właściwy review.

### 20.3 Wyjście z freeze

Obecny walidator zamraża swój kod, aktywne workflow i większość verification authority. Normalny maintenance PR nie jest drogą do dowolnego przywrócenia testów. To techniczna konsekwencja allowlisty, a nie brak pomysłu agenta. Potrzebne jest wcześniej autoryzowane, jawne przejście, utrzymujące ochronę przed niezweryfikowanym runtime i normalny PR/MQ. Nie rekomenduję stałego admin bypassu ani drugiego łańcucha bootstrap/repin.

Usunięcie wszystkich starych testów też nie jest koniecznym krokiem. Poprzedni audyt wskazał nadmiernie szerokie dopuszczenie ich usuwania. Powrót do testów powinien zachować unikalne, nadal właściwe oracles, usuwać świadomie tylko te kontrakty, które należą wyłącznie do porzuconej architektury, oraz odróżniać brak uruchamiania od braku źródeł.

## 21. Prompty, instrukcje i struktura repozytorium

### 21.1 Co rzeczywiście poprawiono

Policy IA po #326 oddziela lifecycle w GitHub Issues, kontrakty w promptach, historię w Git oraz pomocniczy cache aktywnych zadań. Nie należy odtwarzać usuniętego rejestru lifecycle w nowym formacie. Machine policy branch lifecycle nie jest jednak takim rejestrem i nie wolno usuwać jej tylko dlatego, że jest plikiem JSON. [C14, C12]

Root `AGENTS.md` zawiera ważne ograniczenia: granicę Game/Atlas, brak nieuprawnionej publikacji, exact-head, aktualny maintenance i brak automatycznego wyjścia na hosty. Są to wartościowe invariants. Refaktoryzacja instrukcji ma zmniejszyć duplikację i niepotrzebne aktywowanie procedur, nie usuwać tych zabezpieczeń.

### 21.2 Co test canary dowodzi, a czego nie

`test_agent_prompt_lifecycle.mjs` sprawdza usunięcie starego rejestru, wymagane fragmenty policy, brak konfliktu active/archive i dokładne cztery nagłówki w konkretnym canary. Nie uruchamia modelu ani nie mierzy kosztu tokenów, poprawności decyzji, liczby wznowień czy jakości wykonania. [C15, C16]

Nieprawidłowe byłyby dwa skrajne wnioski: „4/4 dowodzi optymalizacji wszystkich agentów” oraz „test strukturalny jest bezwartościowy”. Test chroni część architektury dokumentacji; nie jest ewaluacją zachowania modelu. Dokładne nagłówki dotyczą badanego canary, nie stanowią dowodu globalnego wymogu czterech sekcji we wszystkich promptach.

### 21.3 Dług pozostały

Root README nadal jest wejściem opisującym bootstrap proof, a nie pełnym, aktualnym przewodnikiem uruchomienia i utrzymania. Historyczne długie prompty nadal zawierają obszerne procedury i deklaracje authority. Samo istnienie historycznego tekstu nie jest błędem, jeżeli dispatch wymaga live Issue i tekst jest właściwie oznaczony. Problem powstaje, gdy ścieżka rozpoczynania nowej pracy zmusza do odczytu wielu historycznych instrukcji jako bieżących. [C17, C18]

Root ma 22 060 bajtów. Oficjalny opis Codex pokazuje warstwowe odkrywanie `AGENTS` i domyślny limit 32 KiB dla dokumentów projektu. Nie sprawdzono rzeczywistego `config.toml` użytkownika, więc nie twierdzę, że jego instrukcje są obcinane. Wielkość jest sygnałem do przeglądu zakresu, nie automatycznym błędem. Nie przenoszę też tego limitu bez dowodu na wszystkie inne powierzchnie wykonawcze. [W03]

**RECOMMENDATION.** Root jako mały zestaw bezwarunkowych zasad i selektor kontekstu. Szczegóły publikacji, testowania, hostów i historycznych migracji ładować wtedy, gdy zakres zadania ich wymaga. Bieżący prompt jako rezultat, zakres, istotne ograniczenia i sprawdzalna akceptacja. Nie kopiować całego systemu wykonania do każdej roli. Utrzymać aktualny opis maintenance i nie wymagać od agenta samodzielnego uzgadniania sprzecznych dawnych gate’ów.

Ewaluacja uproszczenia: te same realistyczne zadania i środowisko, porównanie decyzji, ukończenia, nieuprawnionych działań, liczby niepotrzebnych odczytów/wznowień oraz rzeczywistych tokenów. Bez takiego pomiaru oszczędność pozostaje hipotezą. Nie wskazano rzekomo optymalnego effortu ani niezweryfikowanego benchmarku modelu.

### 21.4 Narzędzia i struktura

Brak root `package.json` nie jest samodzielnym problemem dla statycznej aplikacji modułowej. Dodanie frameworka lub bundlera tylko po to, by repo wyglądało typowo, zwiększyłoby zakres utrzymania bez dowodu korzyści. Potrzebne są natomiast jednoznaczne, działające entry points do poszczególnych buildów i weryfikacji oraz aktualny opis zależności.

Duże moduły `web/fullworld-app.mjs` i `web/fullworld-creatures.mjs` warto rozdzielać przy konkretnym zadaniu według pobierania, przejść stanu i kontrolerów, nie według dowolnego limitu linii. Ustalony publiczny kontrakt i regresje dla współbieżności są ważniejsze niż mechaniczne pocięcie pliku na dziesięć importów.

## 22. Bezpieczeństwo zależności, operacje, licencje i recovery

Przejrzane Dockerfile mają przypięte obrazy, a instalacja testowego npm używa lockfile i `--ignore-scripts`. Są to pozytywne kontrole. Nie wykonano jednak skanu wszystkich komponentów obrazu ani pełnego SBOM; nie można z pinów wywnioskować braku podatności. Konfiguracja Dependabot obejmuje tylko GitHub Actions, więc nie stanowi dowodu automatycznej obsługi npm i Docker. Rozszerzenie aktualizacji musi być uzgodnione z maintenance freeze, a nie przywracać stare pipeline’y tylnymi drzwiami. [C19–C21]

**UNKNOWN.** Stan secret scanning/push protection, pełna historia potencjalnych sekretów, aktualne security alerts, uprawnienia środowisk, retencja artefaktów i rzeczywiste ACL wolumenów nie zostały kompletnie zbadane. Nie raportuję „braku wycieków” ani „braku CVE”. Konektor odrzucił próbę części endpointów security; to ograniczenie konkretnej operacji, nie dowód braku zabezpieczenia usługi.

Ostatni wcześniej odczytany udany run Synology dotyczył `d0e2f143…`, a nie badanego obecnego main. Nie określa to samo w sobie aktualnej rewizji kontenera. Aktualny header, image digest, label, mount i realny rollback wymagają bezpośredniej akceptacji w dozwolonej ścieżce operacyjnej. Opis procedury backupu lub istniejący plik recovery nie jest dowodem odtwarzalności.

Licencje i prawa do danych: wcześniejsze attestation są digest- i scope-specific. Nie są niezależną weryfikacją praw do dowolnego nowego zestawu assetów. Syntetyczne obrazy użyte w tym audycie zostały wygenerowane przez harness; nie wykorzystano pakietu Tibia. Nazwy plików kompatybilnościowe w fixture nie stanowią rozszerzenia praw ani zmiany repozytoryjnej polityki publikacji.

**RECOMMENDATION.** Dla konkretnego wydania wymagać powiązania: kod → obraz → manifest → dane → prawa/proweniencja → obecna rewizja endpointu → wynik sprawdzenia cutover i rollback. Nie budować drugiego rejestru statusów; zapisywać tożsamości niezmiennych artefaktów i rzeczywiste zdarzenia akceptacji.

## 23. Rejestr decyzji i kolejność napraw

| Priorytet | Zadanie | Powierzchnia | Minimalny dowód zakończenia |
|---|---|---|---|
| P1 | D01: jeden kontrakt serializacji i kontrolowana kompatybilność | Python publication, JS loader/pixels, schemat/publikacja | Realny mały build przechodzi realny konsument dla ID o różnej długości; tamper nadal odrzucony |
| P1 | D02: ochrona wejścia i staging builda | `publication.py::compile_all` i wywołujące joby | Wszystkie kolizje wyjścia odrzucone bez modyfikacji wejść |
| P1 | D03: storage nie blokuje poprawnych danych | Cache i loadery | Quota/availability fallback działa; uszkodzone dane nadal fail-closed |
| P1 / rozstrzygnięcie | D12: łańcuch zaufania indeksów pomocniczych | Creature publisher/trust/boot i granica danych | Udokumentowany niezależny anchor; spójna podmiana indeksu i dzieci odrzucona w odpowiednim threat model |
| P2 | D04: współbieżność, księgowanie i in-flight | SemanticRangeStore | Licznik zgodny z mapą, brak niepotrzebnych podwójnych żądań, poprawna obsługa anulowania |
| P2 | D05/D07: wspólny transport bounded + URL confinement | Właściwe loadery | Stream abort przed pełnym nadmiarowym pobraniem; resolved URL pozostaje w przestrzeni publikacji |
| P2 | D06/D10/D11: stan, schemat i canonical edge cases | Parsery i kontrakty | Graniczne round-trip, unikalne piętra, brak cichej utraty pól |
| P2 | D08/D09: wiarygodność oracles | E2E support i framebuffer diagnostics | Malformed samples nie generują PASS; rzeczywisty browser fault test na właściwym środowisku |
| P2 | Semantyczna klasyfikacja control-plane | Maintenance policy, branch lifecycle, review | Dokument sterujący nie jest traktowany jak zwykły opis |
| P2 | Jedno wejście dokumentacyjne i aktywny kontrakt promptu | README/AGENTS/IA/Issue #315 | Spójność z aktualnym trybem i brak uruchamiania historycznej procedury jako bieżącej |
| P3 / produkt | Starszy proof i Hunt recommendation | Właściwe moduły i roadmapa | Jawna decyzja: utrzymanie/retirement proof; oddzielny wynik funkcjonalny Hunt |

### 23.1 Integracja napraw w obecnym trybie

Najpierw uzgodnić przejście maintenance → kwalifikacja wybranych zmian, z zachowaniem freeze dla pozostałego produktu. Nie zaczynać od przypadkowego rozszerzenia allowlisty do całego repozytorium. D01, D02 i D03 mogą być przygotowywane i sprawdzane w izolacji, lecz obecny raport ani jego testy nie stanowią zgody na merge tych zmian poza obowiązującym procesem.

Następnie wprowadzić tanie kontrakty i zgodność między producentem a konsumentem do ścieżki shadow. Potwierdzić, że selektor obejmuje zarówno implementację, jak i jej kontrakt, a przypadek niesklasyfikowany nie znika z weryfikacji. Pozytywny canary to za mało: potrzebny jest również celowo błędny kandydat odrzucony z właściwego powodu.

Dopiero potem kwalifikować funkcjonalny browser fixture i minimalną ścieżkę PR/MQ dla zmian produktowych. Przywracać wymaganie konkretnych sprawdzeń po osiągnięciu tych dowodów. Natywny GPU, zgodność przeglądarek, real-source data i kompletna skala świata są odrębnymi kwalifikacjami. Brak jednej specjalistycznej zdolności nie powinien blokować niepowiązanych deterministycznych napraw.

Nie proponuję kolejnego wielkiego koordynatora, nowego systemu lifecycle, stałego przełącznika „wszystko zielone” ani mechanicznego odtworzenia poprzedniego stosu bootstrap. Jedna korekta kontraktu powinna mieć jeden właścicielski PR i jednoznaczny zakres, a nie historię no-op retriggerów.

## 24. Czego wciąż brakuje do pełnego zapewnienia

Nie ma pełnego checkoutu wszystkich bajtów repozytorium i analizy całej historii Git. Nie przejrzano pełnych diffów wszystkich otwartych PR ani każdej linii wszystkich promptów, testów i generatorów. Nie uruchomiono całości deterministic CI ani wszystkich samodzielnych self-testów Python. Te braki ograniczają twierdzenia o całkowitym pokryciu i innych kompensujących kontrolach.

Nie ma bieżącego pełnego E2E aplikacji, natywnego testu WebGL, zakończonej akceptacji wizualnej, Firefox/WebKit ani pomiarów na urządzeniach. Utrata kontekstu GPU, rzeczywista wydajność i UX pozostają otwarte. Nie ma ponownego builda zaakceptowanego real FullWorld oraz pełnego niezależnego sprawdzenia jego źródeł i praw.

Nie ma aktualnego odczytu wdrożenia i udanego realnego restore. Nie ma kompletnego audytu sekretów, zależności i organizacyjnych uprawnień. Ten raport nie powinien być użyty do podpisania „production ready”, „security clean” ani „całe repo sprawdzone”. Są natomiast wystarczające dowody do przedstawionych konkretnych napraw i testów regresyjnych.

## 25. Konkluzja

**Baza faktów:** na niezmienionym main działa ścieżka maintenance, istnieją wartościowe kontrole proweniencji i poprawnie działające fragmenty testów. Nowe wykonanie ujawniło konkretne błędy między producentem i konsumentem, ochrony build input, obsługi cache, stanu oraz niektórych oracles. Wykazano też zakres, w którym istniejące testy nie wykrywają celowych usterek.

**Wniosek:** Atlas potrzebuje nie tylko uproszczenia instrukcji i sposobu uruchamiania testów, lecz również naprawy kilku podstawowych kontraktów wykonawczych. Największą wartość ma teraz usunięcie potwierdzonych przyczyn i dodanie małych testów, które dokładnie je wykrywają. Zachować sensowną architekturę danych i normalną integrację. Nie przenosić sukcesu maintenance na produkt ani lokalnego eksperymentu na pełną kwalifikację produkcyjną.

---

## Dodatek A. Indeks źródeł wykonanych i linii

Wszystkie poniższe pliki mają revision wskazany w nagłówku raportu. Pełne Git blob SHA, wielkości i pochodzenie są w `source-manifest.json`.

| ID | Plik |
|---|---|
| S01 | [`src/browser/fullworld.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/fullworld.mjs) |
| S02 | [`src/browser/fullworld-pixels.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/fullworld-pixels.mjs) |
| S03 | [`src/browser/loader.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/loader.mjs) |
| S04 | [`tools/fullworld-publication/publication.py`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/tools/fullworld-publication/publication.py) |
| S05 | [`src/browser/verified-content-cache.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/verified-content-cache.mjs) |
| S06 | [`src/browser/semantic.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/semantic.mjs) |
| S07 | [`e2e/support/geometry-oracle.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/support/geometry-oracle.mjs) |
| S08 | [`src/browser/framebuffer-probe.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/framebuffer-probe.mjs) |
| S09 | [`src/browser/fullworld-webgl.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/fullworld-webgl.mjs) |
| S10 | [`src/browser/fullworld-performance.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/fullworld-performance.mjs) |
| S11 | [`tests/fullworld-runtime/performance.test.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/tests/fullworld-runtime/performance.test.mjs) |
| S12 | [`src/browser/frame-scheduler.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/frame-scheduler.mjs) |
| S13 | [`tools/build-creature-index.py`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/tools/build-creature-index.py) — zachowany z poprzedniego audytu; nie jest nowym wykonaniem generatora w v2 |

## Dodatek B. Źródła inspekcji konektorowej

| ID | Źródło i zakres |
|---|---|
| C01 | [`src/publication/fullworld-v0.md`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/publication/fullworld-v0.md), cały dokument |
| C02 | [`src/browser/fullworld-trust.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/fullworld-trust.mjs), pełny odczyt przy tym samym SHA |
| C03 | [`web/fullworld-creatures.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/web/fullworld-creatures.mjs), fragmenty inicjalizacji, source checks, draw/interaction i refresh; w v2 m.in. 700–940 oraz 1010–koniec |
| C04 | [`tests/fullworld-runtime/runtime.test.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/tests/fullworld-runtime/runtime.test.mjs), wybrane testy; m.in. 255–koniec, przykłady manifestów i kontroli rootów |
| C05 | [`web/fullworld-app.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/web/fullworld-app.mjs), m.in. 1–165, 430–655, 680–900, 940–koniec; nie pełny review całego modułu |
| C06 | [`src/browser/creature-render-diagnostics.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/browser/creature-render-diagnostics.mjs), pełny odczyt |
| C07 | [`src/hunt-intelligence/consumer.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/src/hunt-intelligence/consumer.mjs), odczyt 1–180 oraz 180–koniec |
| C08 | [`e2e/tests/geometry-desktop.spec.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/tests/geometry-desktop.spec.mjs), odczyt w pierwszej fazie, ten sam SHA |
| C09 | [`e2e/tests/accessibility-desktop.spec.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/tests/accessibility-desktop.spec.mjs), odczyt w pierwszej fazie, ten sam SHA |
| C10 | [`e2e/playwright.config.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/playwright.config.mjs), pełny odczyt, ten sam SHA |
| C11 | [`.github/workflows/terminal-branch-lifecycle.yml`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/.github/workflows/terminal-branch-lifecycle.yml), pełny odczyt, ten sam SHA |
| C12 | [`docs/agents/BRANCH_LIFECYCLE_POLICY.json`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/docs/agents/BRANCH_LIFECYCLE_POLICY.json), cały plik |
| C13 | [Platform reusable workflow](https://github.com/Oteryn/Oteryn-Platform/blob/e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db/.github/workflows/terminal-branch-lifecycle-reusable.yml) na dokładnym pinie `e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db`, cały YAML, nie pełne skrypty Python |
| C14 | [`docs/agents/DOCUMENTATION_AGENT_IA.md`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/docs/agents/DOCUMENTATION_AGENT_IA.md), cały dokument przy tym samym SHA |
| C15 | [`tools/governance/test_agent_prompt_lifecycle.mjs`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/tools/governance/test_agent_prompt_lifecycle.mjs), cały plik |
| C16 | [`docs/agents/prompts/ATLAS-LEAN-PROMPT-CANARY.md`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/docs/agents/prompts/ATLAS-LEAN-PROMPT-CANARY.md), cały plik |
| C17 | [`README.md`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/README.md), cały plik przy tym samym SHA |
| C18 | [`docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md), wskazane początkowe fragmenty; nie pełny przegląd wszystkich 45 564 bajtów |
| C19 | [`e2e/Dockerfile`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/Dockerfile), cały plik |
| C20 | [`e2e/Dockerfile.web`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/e2e/Dockerfile.web), cały plik |
| C21 | [`.github/dependabot.yml`](https://github.com/Oteryn/Oteryn-Atlas/blob/51623c7dab2346cee39cd51e3caa845bf4b65426/.github/dependabot.yml), cały plik |
| G01 | GitHub REST `repos/Oteryn/Oteryn-Atlas/branches/main`, ponowny odczyt przy końcu badania |
| G02 | GitHub ruleset `22103758`, ponowny odczyt przy końcu badania |

Repozytoryjne materiały to authority dla zawartości badanego commitu. Historyczne wyniki runów oraz zamknięcia PR dowodzą tych konkretnych zdarzeń, nie niewykonanej bieżącej kwalifikacji.

## Dodatek C. Źródła zewnętrzne i ich ograniczony zakres

**W01.** RFC 8785, JSON Canonicalization Scheme: [RFC Editor](https://www.rfc-editor.org/rfc/rfc8785.html). Punkt odniesienia dla kanonizacji i wspólnych wektorów. Audyt nie twierdzi, że Atlas deklaruje JCS lub jest z nim zgodny.

**W02.** Service Workers, sekcje cache i storage: [W3C](https://www.w3.org/TR/service-workers/). Uzasadnia traktowanie quota failure jako rzeczywistej klasy błędu API. Nie dowodzi jej wystąpienia na urządzeniu użytkownika.

**W03.** Unrolling the Codex agent loop: [OpenAI](https://openai.com/index/unrolling-the-codex-agent-loop/). Źródło dla warstwowego odkrywania instrukcji i opisanego domyślnego limitu dokumentów projektu. Nie jest benchmarkiem modelu ani odczytem rzeczywistej konfiguracji tej organizacji.
