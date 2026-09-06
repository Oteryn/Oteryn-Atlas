# Oteryn Atlas — audyt repozytorium

**Raport techniczny, architektoniczny i operacyjny**  
**Data:** 6 września 2026 r.  
**Repozytorium:** `Oteryn/Oteryn-Atlas`  
**Badana rewizja:** `51623c7dab2346cee39cd51e3caa845bf4b65426`  
**Drzewo Git:** `8d5b8f1ea3bf636698b8cf7cc81fe434f19f58df`  
**Tryb:** odczyt GitHub; lokalne, izolowane eksperymenty audytowe; bez zmian w repozytorium i infrastrukturze.

---

## 1. Zakres, metoda i poziom pewności

Przedmiotem raportu jest Atlas. Repozytoria META, Game i Platform pojawiają się jako zależności i źródła polityk lub danych; raport nie stanowi pełnego audytu tych repozytoriów ani całej organizacji.

Początkowy i końcowy odczyt `main` wskazał tę samą rewizję: `51623c7…`, commit `docs(agents): consolidate Atlas root execution policy (#341)`. Analizę kodu przypięto do tego SHA, zamiast mieszać treść różnych kolejnych wersji. Ustawienia GitHub, PR-y i przebiegi odczytano bezpośrednio przez konektor. [S01–S07]

**FAKT** oznacza wynik bezpośredniej inspekcji lub wykonanego eksperymentu. **WNIOSEK** oznacza ocenę na podstawie wskazanych faktów. **REKOMENDACJA** jest proponowanym działaniem, nie pracą już wykonaną. **UNKNOWN** oznacza brak danych potrzebnych do rozstrzygnięcia.

Audyt obejmuje przekrojowo wszystkie główne warstwy: cel produktu, granice danych, strukturę kodu, walidację i generowanie, mechanizmy zaufania, przeglądarkę, testy, buildy, CI, Merge Queue, instrukcje agentów, dokumentację, zależności, bezpieczeństwo, publikację i utrzymanie. Szczegółowo sprawdzono wybrane krytyczne ścieżki. Nie jest to deklaracja przeczytania każdej linii każdego pliku.

**Ograniczenie wykonawcze:** sandbox nie rozwiązywał adresu GitHub, a próba pobrania archiwum nie dostarczyła checkoutu. Odczyt przez konektor działał. Nie wykonano pełnego `npm ci`, pełnej macierzy testów, pełnego builda FullWorld ani inspekcji działającej aplikacji w przeglądarce. Zamiast tego wykonano 44 własne, izolowane próby na dwóch plikach skopiowanych z GitHub i sprawdzonych przez identyczność Git blob SHA. Nie uruchamiano zawieszonych workflow. [S08, S19, P01, P02]

### Pokrycie audytu

| Obszar | Faktyczny zakres kontroli | Czego wynik nie potwierdza |
|---|---|---|
| Git i ochrona integracji | `main`, root tree, dwa efektywne rulesety, wymagany status, konfiguracja MQ, rzeczywisty run MQ | Pełnego organization audit log i wszystkich historycznych operacji administracyjnych |
| Instrukcje | Root `AGENTS.md`, wyszukiwanie instrukcji zagnieżdżonych, polityka informacji, reprezentatywny duży prompt, PR #326 | Pełnej treści wszystkich promptów, konfiguracji aplikacji Work/Codex i wszystkich instrukcji globalnych |
| CI | Wszystkie trzy aktywne pliki workflow; inwentarz 25 archiwalnych; fragment starego CI | Pełnego audytu każdego archiwalnego kontrolera i wszystkich usług poza wersjonowanymi workflow |
| Runtime i dane | Trust, loader, walidator publikacji stworzeń, generator indeksu, fragment orkiestratora i walidatora wyszukiwania | Każdego modułu, każdego realnego rekordu Game i pełnej ścieżki renderowania FullWorld |
| Testy | Konfiguracja Playwright, inwentarz E2E, testy geometrii i dostępności, geometry oracle, własne próby negatywne | Pełnego aktualnego census testów, procentu pokrycia, aktualnego wyniku całej macierzy |
| Build i dostawa | Dwa Dockerfile, pakiet E2E, szablon proxy, izolowany mały build generatora, wyniki historycznego runu Synology | Aktualnej aplikacji produkcyjnej, pełnej odtwarzalności publikacji, sprawdzonego rollbacku w tej sesji |
| Bezpieczeństwo i prawa | SECURITY, CODEOWNERS, Dependabot, uprawnienia workflow, deklaracje praw do dwóch paczek | Pełnego SAST, skanu sekretów historii, SBOM/CVE, zewnętrznego potwierdzenia praw do wszystkich publikowanych zasobów |

## 2. Podstawa ustaleń i ocena ogólna

**Podstawa:** sprawdzony kod zawiera rozdzielenie Game/Atlas, tożsamości oparte na digestach, walidację kontraktów, mechanizmy kwalifikacyjnych danych i rzeczywiste testy zachowań. Obecny `main` ma kontrolowany maintenance, działający przebieg Merge Queue oraz scalone uproszczenie rejestru promptów. Jednocześnie eksperymenty wykazały za szerokie usuwanie testów w gate, wyjątek walidacji w historycznym cutover oraz rozbieżności walidacji generatora danych. [S03–S20, S26–S29, P01, P02]

**WNIOSEK — pewność umiarkowanie wysoka dla przejrzanych warstw:** projekt ma sensowny fundament domenowy i istotny istniejący dorobek. Nie ma podstaw do rekomendacji przepisywania całego Atlasa. Najbardziej opłacalna jest redukcja rozbieżności między polityką, implementacją i dowodem działania, a następnie stopniowe przywracanie weryfikacji.

**Ocena gotowości:** potwierdzono działanie ścieżki integracji maintenance. Nie potwierdzono pełnej gotowości wydania produktu z obecnego SHA. To różne rozstrzygnięcia. Zielony maintenance gate nie jest dowodem poprawności renderowania, danych ani wdrożenia.

Nie ustalono w tym audycie potwierdzonej aktywnie wykorzystywanej luki krytycznej. Nie oznacza to, że przeprowadzono pełny audyt bezpieczeństwa lub dowiedziono braku takich luk.

## 3. Rzeczywisty stan projektu i zmian

### Maintenance jest już wdrożony

Na badanym `main` aktywne są dokładnie trzy wersjonowane workflow:

| Workflow | Aktualna rola |
|---|---|
| `.github/workflows/merge-authority-audit.yml` | Walidacja dozwolonego diffu kodem z chronionej bazy, dla PR i Merge Queue |
| `.github/workflows/merge-group-gate.yml` | Dodatkowy `atlas-gate` na zdarzeniu `merge_group` |
| `.github/workflows/terminal-branch-lifecycle.yml` | Zarządzanie cyklem życia gałęzi, przez przypięte reusable workflows Platform |

Dwadzieścia pięć dawnych workflow znajduje się w `docs/maintenance/suspended-workflows/`, w tym CI, CodeQL, kontrolery weryfikacji i Synology Live Acceptance. To nie są obecnie aktywne pliki workflow na `main`. Nie należy utożsamiać ich obecności w Git z wykonywaniem ich na każdym PR. [S02, S05, S09]

W komentarzu #315 zapisano Stage A przez #339 i Stage B przez #340. Ten sam komentarz opisuje jednorazowy, właścicielsko autoryzowany squash bypass przy #340. Jest to udokumentowana relacja w Issue; nie pobrano pełnego dziennika administracyjnego organizacji. Nie należy przedstawiać tej historycznej operacji jako dowodu, że zwykła Merge Queue nadal nie działa. [S07]

### Merge Queue ma obecny pozytywny dowód

Run **34040534843**, zdarzenie **`merge_group`**, dotyczy dokładnie `51623c7…`. Job **101506348064**, `Merge authority audit / protected-base validate`, ma wynik **success**. Sprawdzono także sukces kroków checkoutu chronionej bazy, checkoutu kandydata i egzekwowania freeze. [S06]

Aktualny wymagany status w rulesecie repozytorium to **`Merge authority audit / protected-base validate`**, App **15368**, a nie dawny PR-niemożliwy `atlas-gate`. Status audytu jest emitowany zarówno dla PR, jak i MQ. Historyczna pętla „PR musi mieć atlas-gate, aby wejść do MQ, ale atlas-gate powstaje dopiero w MQ” nie opisuje już odczytanej konfiguracji. [S04–S07]

### Część porządków instrukcji jest zakończona

PR **#326** jest scalony od 6 września 2026 r., 14:35:52 UTC; merge commit to `9755e31513c7949035b4d446ab9132880dac80e1`. Aktualna polityka nie utrzymuje osobnego mutowalnego rejestru lifecycle. Issues odpowiadają za stan, prompty za kontrakty zadań, Git za historię, a `tasks/active` jest jedynie pomocniczym cache. Nie rekomenduję ponownego wykonywania tej już scalonej zmiany. [S10, S11]

### Stary run Synology już się zakończył

Run **34033820190**, który w starszym komentarzu był jeszcze uruchomiony, ma obecnie wynik **success**. Dotyczy jednak wcześniejszego `d0e2f143ae678c97c0657cdd8e446725ab0a11f3`, nie bieżącego `51623c7…`. Job **101488141779** raportuje sukces budowy produktów, atomowego cutover i bounded desktop/mobile Chromium E2E. To pozytywny dowód historyczny, a nie wykonana w tej sesji akceptacja obecnego serwera. [S12]

## 4. Projekt, założenia i granice architektury

### Co należy zachować

README i AGENTS rozdzielają kanoniczną semantykę World/Content w Game od indeksowania, transportu, renderowania, wyszukiwania i publikacji w Atlasie. Atlas nie ma stawać się drugą bazą prawdy o NPC, potworach, przedmiotach i loot. To ograniczenie jest istotniejsze niż wybór frameworka UI. [S03, S13]

W przejrzanym kodzie widać realne mechanizmy podtrzymujące tę granicę: jawne kontrakty, capability, digesty, profile współrzędnych, identyfikatory fixture i wiązanie źródeł animacji z publikacją stworzeń. `creature-publication-source.mjs` sprawdza zgodność kontraktu, capability, semantycznego digestu, wersji schematu ról i korzeni wyglądu/animacji. [S14–S16]

`fullworld-trust.mjs` rozdziela produkcyjny zestaw rootów od `qualification_fixture` i `bounded_real_world`. To potwierdzona implementacja części wymaganej separacji danych testowych. Nie stanowi jeszcze dowodu, że każdy scenariusz E2E ma prawidłowo wybraną minimalną capability. [S14]

Różne przypięte SHA Game dla różnych niezmiennych produktów nie są automatycznie błędem. O ich zgodności powinny decydować jawne kontrakty i powiązania digestów, a nie założenie, że każda publikacja musi pochodzić z jednego wspólnego historycznego commita. [S14–S16]

### Cel produktu jest słabiej opisany niż jego mechanika

README nadal przedstawia początkowy `Semantic Thais Z7 Proof`. Tymczasem drzewo zawiera FullWorld, wyszukiwanie, stworzenia, gameplay inspector, farm explorer i rozbudowane E2E. README nie daje bieżącej ścieżki instalacji, uruchomienia, testowania ani objaśnienia maintenance. [S02, S13, S17]

**REKOMENDACJA:** opisać aktualny cel użytkowy i wejście do projektu, oddzielając funkcje dostępne, eksperymentalne i zablokowane brakiem danych Game. Wykorzystać istniejące Issues i kontrakty capability; nie tworzyć kolejnego ręcznie synchronizowanego rejestru stanów.

W tym audycie **UNKNOWN** pozostają aktualne produktowe SLO, pełna lista zaakceptowanych user journeys i stopień ich domknięcia. Nazwa modułu albo obecność pliku testowego nie jest akceptacją funkcji.

## 5. Rejestr ustaleń

Priorytety są kolejnością inżynierską, nie ocenami CVSS. P1 oznacza problem wymagający rozstrzygnięcia przed dalszym poleganiem na danej kontroli; P2 — zaplanowaną korektę w odpowiedniej fazie; P3 — porządkowanie lub uzupełnienie dowodów. Wysoki priorytet nie oznacza automatycznie zdalnej podatności bezpieczeństwa.

| ID | Priorytet | Ustalenie | Klasa i zakres |
|---|---|---|---|
| A01 | P1 | Gate dopuszcza usunięcie dowolnego pasującego testu verification, nie tylko obsolete governance | Potwierdzony eksperymentalnie problem bieżącej polityki |
| A02 | P2 przed przyszłym cutover | Dokument maintenance omija kontrolę typu/trybu w ścieżce cutover | Potwierdzony defekt historycznej ścieżki przejścia; nie dowód obecnego obejścia runtime |
| A03 | P2 | Generator stworzeń akceptuje wartości niezgodne z rygorem odbiorcy | Potwierdzone trzy przypadki; defense-in-depth i spójność kontraktów |
| A04 | P2 | Limit odpowiedzi jest egzekwowany po pełnym zbuforowaniu | Potwierdzona właściwość kodu; brak reprodukcji OOM |
| A05 | P2 | Dokumentacja maintenance i ogólne instrukcje merge nie opisują spójnie aktualnego wymaganego checka | Potwierdzony dług instrukcji/operacyjny |
| A06 | P2 przed wyjściem z maintenance | Obecny gate nie dopuszcza zwykłego PR przywracającego workflow lub zmieniającego sam gate | Potwierdzone ograniczenie projektu; wymagany plan autoryzowanego przejścia |
| A07 | P2 / decyzja właściciela | Bypass pozostaje technicznie dostępny; brak wymuszonych approvali | Potwierdzona konfiguracja; nie dowód nadużycia |
| A08 | P2 | Część testu floor-isolation może zostać pominięta warunkowo bez awarii testu | Potwierdzona struktura scenariusza; brak dowodu pominięcia w realnym runie |
| A09 | P2 przy wznowieniu wydań | Aktualny profil przeglądarek obejmuje tylko Chromium | Potwierdzona konfiguracja; nie dowód awarii innych silników |
| A10 | P2 przy odmrożeniu zależności | Dependabot obejmuje Actions, nie npm E2E ani Docker | Potwierdzona luka tej konfiguracji aktualizacji; CVE UNKNOWN |
| A11 | P2/P3 | Brak aktualnej kwalifikacji produktu z badanego SHA w wykonanym audycie | Luka dowodowa, nie stwierdzona awaria produktu |
| A12 | P3 | Duże historyczne prompty i kontrolery utrudniają selekcję aktualnego kontraktu | Wniosek o utrzymywalności, częściowo złagodzony przez #326 |

### A01 — zakres usuwania testów jest zbyt szeroki

**FAKT.** `tools/maintenance/verify-maintenance-diff.mjs:73–81` dopuszcza operację `D` dla całego wzorca `tests/verification/...*.test.mjs`. Kod nie rozróżnia przestarzałego kontraktu governance od walidacji produktu, danych czy niezależnego oracle. Root AGENTS opisuje znacznie węższy zamiar: usuwanie obsolete governance contracts. [S03, S08]

Próba `product_test_delete` na dokładnym blobie `714fb73fe08b7c741d606c6e5a8ecdf33a3adf10` została zaakceptowana. Syntetyczny przykład używa ścieżki `tests/verification/bounded-real-world.test.mjs`, która istnieje również w rzeczywistym repozytorium. Zawartość testu w eksperymencie była wymyślona; nie usunięto pliku w Atlasie. [P01, S18]

**Skutek:** maintenance może dopuścić szersze usunięcie ochrony regresyjnej, niż wynika z deklaracji polityki. Nie jest to obejście zamrożenia kodu runtime. Git zachowuje historię, ale nie zastępuje obecnego testu w przyszłym census kwalifikacji.

**REKOMENDACJA:** przyszła poprawka gate’u powinna dopuszczać wyłącznie jawnie wskazane, przejrzane usunięcia przestarzałych testów governance. Bez ogólnego wyjątku dla całej rodziny testów. Kryterium akceptacji: dozwolone usunięcie konkretnego obsolete contract przechodzi; usunięcie bounded-real, oracle, security lub product regression jest odrzucane. Sam gate jest teraz zamrożony, więc jego zmiana wymaga osobno autoryzowanego przejścia, a nie zwykłego maintenance PR.

### A02 — wyjątek walidacji dokumentu w cutover

**FAKT.** W `verifyCutover`, linia 120 wyłącza `docs/maintenance/ATLAS-MAINTENANCE-MODE.md` z `verifyRegularText`. Trzy własne próby wykazały przyjęcie dowiązania symbolicznego, treści binarnej/niepoprawnego UTF-8 oraz trybu wykonywalnego dla tej ścieżki podczas syntetycznego przejścia Stage A → Stage B. [S08, P01]

**Zakres:** trzy wyniki to jedna wspólna przyczyna, nie trzy niezależne krytyczne luki. Aktualny dokument na badanym `main` jest regularnym plikiem `100644` z czytelnym Markdown. Bieżąca normalna ścieżka maintenance kontroluje tryb i treść. Nie wykazano wykorzystania wyjątku w rzeczywistym cutover. [S09, S20]

**REKOMENDACJA:** przed ponownym użyciem podobnej ścieżki przejścia walidować każdy nowy lub zmodyfikowany plik dozwolonego zbioru, bez wyjątku uzasadnianego samą nazwą dokumentu. Zachować regresje dla mode, symlink, UTF-8, NUL i rozmiaru.

### A03 — producent i konsument danych nie egzekwują identycznego kontraktu

**FAKT.** W `tools/build-creature-index.py`:

- linie 37–39 sprawdzają prefiks i długość digestu, ale nie alfabet szesnastkowy;
- linie 51–53 przyjmują współrzędne rozpoznawane przez `isinstance(value, int)`, w tym `True`;
- linie 54–56 sprawdzają prefiks i górny limit długości `record_id`, a nie wymagany format 32 cyfr hex.

Próby `nonhex_digest`, `boolean_coordinate` i `malformed_record_id` zostały zaakceptowane przez rzeczywistą funkcję `validate()` z dokładnego blobu generatora. Tymczasem przeglądarkowy `creature-search.mjs` wymaga identyfikatora zgodnego z regexem 32 hex i `Number.isSafeInteger` dla współrzędnych. Walidator źródła publikacji wymaga SHA-256 w formacie hex. [S16, S19, S21, P02]

**Skutek i ograniczenie:** generator może zaakceptować wejście, którego konsument nie zaakceptuje. To luka we wczesnym wykrywaniu niespójnych danych. Nie wykazano, że realny eksport Game zawiera takie wartości ani że przejdą one wszystkie upstream validators i produkcyjny trust root. Nie jest to dowód fałszowania kanonicznych danych na produkcji.

**REKOMENDACJA:** ustanowić jeden semantyczny kontrakt producent–konsument, sprawdzany wspólnym korpusem przykładów poprawnych i błędnych w Pythonie oraz JavaScript. Walidacja ma odrzucać booleany, wymagać pełnego formatu digestu i identyfikatorów oraz zgodnego zakresu liczb całkowitych. Nie musi to oznaczać nowej biblioteki ani współdzielenia implementacji oracle.

### A04 — limit danych nie jest limitem pobrania do pamięci

**FAKT.** `src/browser/loader.mjs::readBoundedResponse` i `web/fullworld-creatures.mjs::boundedJson` sprawdzają `Content-Length`, jeśli istnieje, następnie wykonują `response.arrayBuffer()`, a dopiero później sprawdzają rzeczywistą liczbę bajtów. [S15, S22]

**WNIOSEK — wysoka pewność dla tego przepływu:** przy brakującym lub nieadekwatnym nagłówku limit chroni przed zaakceptowaniem zbyt dużego dokumentu, ale nie zapobiega wcześniejszemu zbuforowaniu zbyt dużej odpowiedzi. Nie przeprowadzono próby wyczerpania pamięci urządzenia.

**REKOMENDACJA:** wspólny czytnik strumieniowy z licznikiem rzeczywiście odczytanych bajtów, przerwaniem pobierania po przekroczeniu limitu oraz obsługą anulowania/timeoutu. Zachować walidację digestów i rozmiaru deklarowanego w manifeście. Regresje powinny obejmować brak `Content-Length`, błędny nagłówek, nadmiarowe chunki i anulowanie nieaktualnego żądania.

### A05 — bieżąca dokumentacja operacyjna jest niespójna

**FAKT.** `docs/maintenance/ATLAS-MAINTENANCE-MODE.md` opisuje jeszcze „this Stage B candidate” i wymagany `atlas-gate`; na aktualnym `main` cutover już istnieje, a wymaganym statusem jest audyt. Ogólna sekcja `AGENTS.md:Validation and merge` nadal żąda exact-head CI obejmującego `atlas-gate`, podczas gdy aktywny `atlas-gate` jest wyłącznie MQ. Maintenance jest opisany we wcześniejszej sekcji, więc istnieje poprawny kontekst, ale nie usuwa to konieczności interpretowania niespójnych sformułowań. [S03–S05, S20]

Opis główny #315 jest starszy niż późniejsze komentarze. Komentarze dokumentują realny postęp; błędem byłoby twierdzić, że cutover w ogóle nie został zapisany. Problemem jest brak jednego aktualnego podsumowania stanu operacyjnego, nie brak jakiejkolwiek historii. [S07]

**REKOMENDACJA:** poprawić istniejący dokument maintenance i trybozależne brzmienie AGENTS; zaktualizować bieżące podsumowanie Issue. Nie dodawać nowego rejestru odzwierciedlającego ręcznie statusy GitHub. Nazwy wymaganych checków sprawdzać z efektywnych rulesetów.

### A06 — wyjście z maintenance wymaga jawnego planu kontroli

**FAKT.** Zwykła ścieżka gate’u zabrania zmian `tools/maintenance/**` oraz aktywnych workflow. Własne próby `gate_edit` i `workflow_restore` zostały odrzucone zgodnie z tym projektem. Root README również nie jest normalną dozwoloną ścieżką: próba `readme` została odrzucona. [S08, P01]

To celowa ochrona freeze, nie argument za osłabieniem go. Jednocześnie nie wolno obiecywać, że obecny zwykły PR sam przywróci shadow workflow albo zaktualizuje zamrożony gate.

**REKOMENDACJA:** przed etapem odbudowy CI przygotować jedno jasno autoryzowane przejście samej kontroli: przejrzany exact SHA, wymagane regresje, ciągłość PR/MQ, niezmieniony zakaz runtime podczas porządków i brak interwału bez ochrony. Nie uruchamiać kolejnego wielowarstwowego programu bootstrapu ani nie traktować bypassu jako normalnej ścieżki pracy. Treść nowego README można przygotować teraz, ale integrację podporządkować rzeczywistej dozwolonej polityce.

### A07 — polityka review i wyjątku powinna odpowiadać ustawieniom

**FAKT.** Ruleset `22103758` ma `required_approving_review_count=0` i nie wymaga review CODEOWNERS. Zawiera bypass użytkownika `blakinio` w trybie `pull_request`. Ruleset organizacyjny `22352928` dopuszcza analogiczny bypass dla OrganizationAdmin. CODEOWNERS wskazuje `@blakinio` dla całego repozytorium i obszarów krytycznych. [S04, S23]

Nie wynika z tego, że PR-y nie były faktycznie przeglądane ani że bypass był używany bez zgody. Wynika, że część zapewnień proceduralnych nie jest wymuszona przez serwer.

**REKOMENDACJA:** właściciel powinien świadomie określić, co jest serwerowym warunkiem, co przejrzanym dowodem niezależnego review, a co wyjątkiem awaryjnym. Przy jednym ownerze mechaniczne włączenie reguły wymagającej niedostępnego drugiego zatwierdzającego mogłoby zablokować pracę. Wymaga to decyzji organizacyjnej, nie automatycznej zmiany ustawień podczas audytu.

## 6. Kod, moduły i struktura repozytorium

Root tree rozdziela `web/`, `src/`, `tools/`, `tests/`, `e2e/` i `docs/`. Nie ma root `package.json`; pakiet Playwright istnieje pod `e2e/`. Nie należy więc oceniać repozytorium przez samo powodzenie komendy `npm test` w root. Jest to kombinacja aplikacji modułowej JavaScript, narzędzi Python i harnessu przeglądarkowego. [S02, S17, S24]

W przejrzanych interfejsach widoczny jest sensowny podział: walidacja źródeł, geometria, stan interakcji, layout/LOD, gameplay profiles, dane semantyczne i narzędzia publikacyjne. Równocześnie `web/fullworld-app.mjs` ma 49 905 bajtów, a `web/fullworld-creatures.mjs` 50 034 bajty. Początek drugiego modułu skupia wiele aspektów stanu: cache, animację, interakcję, inspektor, generacje renderowania i diagnostykę. [S17, S22]

**WNIOSEK — pewność umiarkowana:** centralna orkiestracja jest potencjalnym miejscem kosztownych review i zmian. Rozmiar nie dowodzi błędu ani nie uzasadnia refaktoryzacji dla samej liczby plików.

**REKOMENDACJA:** po odmrożeniu, tylko przy rzeczywistej zmianie zachowania, wydzielać spójne odpowiedzialności: pobieranie i zaufanie, przejścia stanu, koordynację renderowania, kontrolery UI. Zachować jawne zależności i istniejące niezależne oracles. Nie wprowadzać frameworka ani globalnego state store tylko po to, aby „unowocześnić” projekt.

Nie wykonano pełnego grafu importów, detekcji martwego kodu ani analizy wszystkich duplikacji. `protected-qualification-oracle.mjs` i `protected-bounded-oracle.mjs` zawierają kod zbieżny z walidatorami runtime; bez pełnego przeglądu procesu generowania nie należy uznawać każdego podobnego fragmentu za ręcznie utrzymywany duplikat. [S25]

## 7. Testy, oracles i realna kompletność

### Mocne strony potwierdzone w kodzie

Playwright ma `retries: 0`, `forbidOnly: true`, stałą lokalizację i strefę czasową, artefakty błędów oraz przypięty obraz. Nie stwierdzono w tej konfiguracji maskowania pierwszego błędu automatycznymi retries. [S26]

Test geometrii porównuje generacje i transformacje bazowego renderera oraz warstwy stworzeń, przechodzi przez realne zdarzenia myszy i zapisuje event log. Oracle sam oblicza projekcję, nie importuje produkcyjnego helpera transformacji, a brak faktycznych kotwic przy porównaniu jest błędem. To wartościowy zasób, którego nie należy usuwać wyłącznie dlatego, że stary orchestration stack był kłopotliwy. [S27, S28]

Testy dostępności sprawdzają role, accessible names, stany disabled, docieranie tabulatorem i aktywację funkcji klawiszami Enter/Space. To więcej niż samo sprawdzanie obecności elementów DOM. Jednocześnie nie jest to pełny audyt zgodności dostępności ani badanie czytnikiem ekranu. [S29]

### A08 — warunkowe pominięcie istotnego fragmentu scenariusza

W drugim teście geometrii blok zmiany piętra jest wykonywany tylko, gdy `floorDown.isEnabled()` zwraca prawdę. W przeciwnym razie test może dalej przejść przez pozostały reload/pan, nie sprawdzając przełączenia piętra mimo nazwy scenariusza. [S27]

**REKOMENDACJA:** osobny scenariusz wymagający fixture z dostępnym sąsiednim piętrem i jawna asercja tego warunku. Jeżeli scenariusz ma badać brzeg mapy, powinien mieć oddzielny kontrakt oczekiwanego disabled state. Nie dodawać arbitralnego skipa ani retry.

### A09 — Chromium nie jest wielosilnikową kwalifikacją

W bieżącym `playwright.config.mjs` projekty desktop, mobile i dodatkowe nightly używają Chromium. Mobilny viewport z `isMobile` nie stanowi dowodu działania Safari/WebKit na urządzeniu. W wynikach otwartych PR istnieje #141 dotyczący Firefox/WebKit, ale jego zmiany nie są częścią badanego `main`. [S26, S30]

**REKOMENDACJA:** po wyjściu z maintenance ustalić rzeczywistą obietnicę wsparcia przeglądarek. Dopiero do niej dobrać małą macierz smoke/functional. Stary PR wymaga ponownego sprawdzenia względem aktualnych kontraktów; nie powinien automatycznie wyznaczać docelowej architektury.

### Czego nie wiadomo

Nie ustalono aktualnego pełnego census stable IDs, procentu pokrycia kodu, wskaźnika flakiness ani tego, że każdy z istniejących scenariuszy jest niezależny i konieczny. Inwentarz zawiera m.in. race, resilience, performance, scale, soak, stress, visual i user journeys, ale nazw plików nie potraktowano jako dowodu ich skuteczności. [S31]

Wyników historycznych przytoczonych w #315 nie przeniesiono na obecny SHA. Nie otwierano i nie zatwierdzano pełnoklatkowych artefaktów wizualnych produktu.

## 8. Własne eksperymenty audytowe

### P01 — granice maintenance

Badany oryginalny plik ma blob `714fb73fe08b7c741d606c6e5a8ecdf33a3adf10`. Lokalny `git hash-object` dał ten sam wynik. `node --check` zakończył się poprawnie. Środowisko: Node `v22.16.0`, Git `2.47.3`.

Wykonano **33 próby** na syntetycznych repozytoriach Git. **29** odpowiadało jawnie zapisanym oczekiwaniom, **4** wykazały rozbieżność. Dobre wyniki obejmują m.in. odrzucenie runtime/mixed changes, edycji gate’u, odtwarzania workflow, niepoprawnych tożsamości, brudnych drzew, rename escape oraz niedozwolonych trybów/treści zwykłego dokumentu. Potwierdzono także dozwolone maintenance, prawidłowy syntetyczny MQ i poprawny syntetyczny cutover.

Cztery rozbieżności to A01 oraz trzy warianty jednej przyczyny A02. Nie jest to wynik pełnego istniejącego zestawu testów Atlasa ani symulacja wszystkich zachowań GitHub Actions.

### P02 — generator indeksu stworzeń

Badany plik ma blob `325c63b22b5b75797af7ecb47f1aaae5f577657f`; lokalna kopia została zweryfikowana identycznie. Wykonano **11 prób**, z czego **8** odpowiadało oczekiwaniom, a **3** pokazały rozbieżności A03.

Sprawdzono przyjęcie poprawnego static/animated input, odrzucenie złego kontraktu, capability, profilu współrzędnych, ról NPC przypisanych potworowi i zduplikowanych ról. Dwa małe buildy identycznego syntetycznego wejścia w świeżych katalogach wytworzyły trzy identyczne bajtowo pliki wyjściowe, potwierdzone przez SHA-256.

To potwierdza odtwarzalność tej konkretnej małej próbki. Nie potwierdza pełnego builda świata, kompletności walidacji upstream Game, wszystkich platform ani przyjęcia publikacji przez rzeczywistą przeglądarkę.

Pliki odtworzeniowe: `probe_maintenance.py`, `probe_creature_builder.py`, katalogi `sources/` i `results/`. Nazwy i SHA syntetycznych commitów w logach nie są commitami repozytorium Oteryn.

## 9. Buildy i odtwarzalność dostawy

`e2e/Dockerfile` przypina obraz Playwright digestem, używa `npm ci --ignore-scripts --no-audit --no-fund` i kopiuje harness oraz niezbędny helper stable ID. `e2e/Dockerfile.web` przypina digest obrazu nginx-unprivileged i kopiuje `web`, `src` oraz konfigurację proxy. To dobre fundamenty powtarzalnego harnessu. [S24, S32]

Przypięcie wersji nie jest dowodem braku podatności; `--no-audit` w kroku instalacji samo w sobie też nie jest dowodem podatności. Weryfikacja podatności jest oddzielnym zadaniem i w tej sesji nie została wykonana.

Szablon E2E przekazuje `/fullworld/` i `/data/creatures/` do publication upstream. Oznacza to, że sam image z frontendem nie jest pełnym, samowystarczalnym produktem danych. Trzeba jawnie odróżniać kod, konfigurację harnessu i niezmienne produkty świata. [S33]

Stare CI miesza testy kontraktów repo, kompilację Python, testy konsumenta, Chrome/WebGL i sprawdzanie konkretnych historycznych identyfikatorów oraz liczb artefaktu Thais. Część tych asercji może nadal być wartościową kontrolą historycznej próbki; nie należy jednak automatycznie przenosić wszystkich do obowiązkowej ścieżki każdego nowego PR. [S34]

**REKOMENDACJA:** określić najkrótszą odtwarzalną ścieżkę „świeży checkout → mały qualification product → bounded browser smoke”, a osobno build i publikację realnego świata. Nie wymuszać FullWorld na zwykłej regresji UI. Pełne wydanie powinno mieć jednoznaczne związanie rewizji kodu, digestów produktów, obrazu i dowodów akceptacji.

## 10. CI, koszt i docelowa odbudowa weryfikacji

### Co uproszczenie już osiągnęło

Aktywna ścieżka maintenance nie uruchamia dawnego stosu kwalifikacji produktu. Wymagany workflow uruchamia kod z chronionej bazy; kandydat jest wejściem do analizy diffu. Checkouty mają `persist-credentials: false`, akcje są przypięte SHA, a job walidatora ma tylko `contents: read`. To istotne właściwości bezpieczeństwa, których nie należy usuwać w imię redukcji liczby linii. [S05]

Dawny stos obejmuje wiele osobnych admission, promotion, readiness, controller i fan-in mechanizmów. Dwa archiwalne workflow mają odpowiednio 83 848 i 80 779 bajtów. Takie rozmiary są sygnałem kosztu zrozumienia i utrzymania, nie samodzielnym dowodem zmarnowanych minut CI. [S09, S25]

### Minimalny sensowny kierunek

**REKOMENDACJA:** odbudowywać przepływ z małej liczby odpowiedzialności: zaufana klasyfikacja zmiany; najtańsza adekwatna regresja; wybrane bounded browser groups; jednoznaczna agregacja dowodów na właściwej rewizji. Nie zaczynać od odtworzenia całej historycznej topologii promotion/controller.

Zachować oddzielenie zakresu weryfikacji od danych. `full` oznacza pełny zakres istotnych zachowań, nie obowiązkowo cały realny świat. Qualification fixture musi przechodzić przez rzeczywiste kontrakty loadera/manifestu i runtime, a nie alternatywny „łatwy” produkt testowy. Real FullWorld lub specjalistyczny host powinien wynikać z potrzeby konkretnego oracle. [S03, S14]

Każdą przywracaną grupę najpierw uruchamiać w shadow, dopiero po kontrolowanym przejściu opisanym w A06. Wymagać rzeczywistego PR/MQ canary i negatywnego przypadku pokazującego, że grupa potrafi wykryć odpowiednią regresję. Zielony przebieg bez tego nie dowodzi skuteczności testu.

### Pomiary, których brakuje

**UNKNOWN:** obecne p50/p95 czasu kolejki i wykonania, udział bootstrappingu, transfer danych, liczba powtórnych buildów, koszt cold/warm cache, flakiness oraz koszt tokenowy agentów. Nie podano procentowych oszczędności, bo brak danych do ich policzenia.

Właściwy benchmark powinien rozdzielać queue, startup obrazu, przygotowanie danych, build, test i publikację artefaktów. Dobór liczby workerów lub shardów powinien wynikać z tych pomiarów, nie z założenia, że więcej równoległości jest zawsze lepsze. Domyślne `workers=2` w Playwright jest parametrem, nie wynikiem aktualnego benchmarku. [S26]

## 11. Prompty, instrukcje i wiedza projektowa

### Aktualny model informacji jest wyraźnie lepszy

Scalone #326 wprowadza właściwe rozdzielenie odpowiedzialności: prompt to kontrakt wielokrotnego użytku, Issue to stan i ownership, Git to provenance, packet to cache. Polityka wyraźnie zabrania odtwarzania mutowalnego rejestru dublującego GitHub. Ten kierunek należy utrzymać. [S10, S11]

Wyszukiwanie kodu dla `AGENTS.md` zwróciło jeden plik root związany z badanym SHA; dla `AGENTS.override.md` zwróciło zero wyników, bez oznaczenia niekompletnych wyników. Nie jest to odczyt konfiguracji agentów poza repozytorium. [S35]

### Dług pozostał w treści i sposobie aktywacji

Root AGENTS ma 22 060 bajtów. Reprezentatywny prompt `ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md` ma 45 564 bajty; przejrzano jego początkowe 130 linii. Zawiera odrębną deklarację corrective authority, obowiązkową listę wielu dokumentów, powtarzane preflighty i szeroki imperatyw końcowego domknięcia programu. Część informacji jest cenną historią architektury, ale nie powinna być automatycznie traktowana jako obecne zlecenie wykonawcze. [S03, S36]

Aktualna polityka IA już ogranicza to ryzyko: obecność historycznego promptu nie czyni go dispatchable, a do mutacji potrzebna jest bieżąca authority. Dlatego nie rekomenduję bezrefleksyjnego usunięcia wszystkich długich plików.

**REKOMENDACJA:** w aktywnym kontrakcie pozostawić rezultat, zakres, specyficzne niezmienniki i dowód akceptacji. Repozytoryjne zasady autoryzacji, narzędzi, review i merge dziedziczyć z aktualnej polityki. Historyczne programy opatrzyć czytelnym kontekstem historycznym albo wycofać z powierzchni uruchamiania po sprawdzeniu Issue. Nie synchronizować przy tym ponownie stanu Issues do nowego JSON.

Folder `docs/superpowers` w drzewie nie dowodzi aktywnego pluginu, hooka ani skilla. Nie audytowano ustawień zainstalowanych pluginów lub globalnej konfiguracji użytkownika. [S02]

Nie przeprowadzono pomiaru zużycia tokenów, czasu agentów ani porównania effort/model. Nie da się na tej podstawie uczciwie podać konkretnej oszczędności lub optymalnego effort.

## 12. Wydajność, pamięć i ergonomia

Dokument `src/browser/fullworld-runtime-v0.md` opisuje LOD, viewport working set, bounded prefetch, dirty-frame rendering, instancing i weryfikowany cache. Wymienia też main-thread JSON decode i rezerwację tekstur dla pełnego zbioru pikseli. Są to wskazane w repozytorium obszary pomiarowe; nie zweryfikowano pełnej implementacji i nie wykonano profilowania GPU. [S37]

Ten sam dokument mówi o zablokowanej animacji, podczas gdy aktualny `fullworld-trust.mjs` oznacza animation jako enabled/PROVEN. Dokument zawiera więc co najmniej jedną nieaktualną deklarację i nie powinien samodzielnie służyć jako certyfikat obecnego runtime. [S14, S37]

**REKOMENDACJA:** mierzyć pamięć JS, alokację tekstur, transfer, czas parsowania i opóźnienie reakcji użytkownika osobno. Nie traktować network LOD jako automatycznej gwarancji małego GPU footprint. Nie dodawać Web Workers bez pomiaru pokazującego, że przenoszenie pracy i danych rzeczywiście pomaga.

Dla UX wartością są już testowane ścieżki klawiatury, URL/state i synchronizacji warstw. Natomiast czytelność, clipping, hit-targets, zachowanie na realnym telefonie, kontrast i odbiór pełnej klatki pozostają w tym audycie **UNKNOWN**. Nie wyciągnięto oceny wizualnej z samego kodu ani z nieotwartych screenshotów.

## 13. Bezpieczeństwo, zależności i prawa do publikacji

SECURITY prawidłowo wskazuje ingestion, parsing/rendering, artefakty, dependencies i provenance jako obszary wrażliwe. Zaleca zgłoszenia prywatne, nie publikowanie sekretów i przypinanie Actions. Sam zapis o private vulnerability reporting nie potwierdza, że opcja jest faktycznie włączona w ustawieniach GitHub. [S38]

Przejrzane workflow ograniczają uprawnienia i oddzielają zaufaną bazę od kandydata. Terminal branch lifecycle celowo ma `contents: write` w zadaniach zamykających/usuwających gałęzie i korzysta z przypiętych workflow Platform. Audyt objął wrapper Atlas, nie pełny kod zależnego workflow Platform. Nie należy więc przenosić oceny bezpieczeństwa wrappera na całą tę zależność. [S05]

### A10 — zarządzanie aktualizacjami nie obejmuje wszystkich zadeklarowanych zależności

`.github/dependabot.yml` ma tylko `package-ecosystem: github-actions`. Tymczasem istnieją `e2e/package.json` z Playwright i dwa Dockerfile z przypiętymi obrazami. Nie stwierdzono w tym pliku automatycznej ścieżki aktualizacji npm ani Docker. [S24, S32, S39]

**REKOMENDACJA:** po dopuszczeniu odpowiednich zmian zapewnić jedną prostą ścieżkę aktualizacji całego spójnego zestawu Playwright package/image oraz nginx, z adekwatnymi regresjami. Nie otwierać masowo dependency PR wbrew maintenance freeze. W okresie freeze odróżnić obserwowanie ryzyka od automatycznego integrowania aktualizacji.

Szablon E2E nginx zawiera nosniff, no-referrer, SAMEORIGIN, no-store i nagłówek rewizji kodu. Nie zawiera CSP w przejrzanym pliku. To opis harnessu, nie zweryfikowana konfiguracja publicznego serwera. Transport TLS, efektywna CSP, uprawnienia środowisk i zabezpieczenia sekretów produkcyjnych pozostają niezweryfikowane. [S33]

### Licencja i prawa do danych

W root tree nie ma pliku LICENSE. To obserwacja struktury, nie rozstrzygnięcie prawne o dopuszczalności publikacji. W `docs/legal/` są dwie deklaracje właścicielskie powiązane z digestami konkretnych archiwów. Jedna wyraźnie ogranicza dokładny pakiet 15.32 do bounded proof; druga opisuje również dalszą publikację z konkretnej paczki. Nie należy dowolnie uogólniać ich na inne dane, wersje lub powierzchnie publikacji. [S02, S40]

**REKOMENDACJA:** przed nowym zakresem publikacji sprawdzić spójność „dokładny asset digest → zakres deklaracji → artefakt → publiczny kanał”. Oddzielnie określić zasady licencjonowania własnego kodu. Nie wykonano niezależnego potwierdzenia zewnętrznych praw autorskich i nie wydaje się tu opinii prawnej.

## 14. Wdrożenia, obserwowalność i odzyskiwanie

Root AGENTS wymaga wdrożeń wyłącznie z merged `main`, zgodności revision w etykiecie kontenera i nagłówku HTTP oraz rollbacku do wcześniej scalonej rewizji. To konkretne, audytowalne kryteria, które należy zachować. [S03]

Historyczny run Synology daje pozytywny sygnał o istniejącej zdolności budowy i akceptacji. Nie dostarcza aktualnego odczytu uruchomionego obrazu, nagłówków serwera, digestów danych, stanu wolumenów ani ostatniego udanego odtworzenia backupu. [S12]

**UNKNOWN:** aktualny live revision, rzeczywista konfiguracja hosta i reverse proxy, dostępność runnerów, monitoring i alerty, retencja kopii, RPO/RTO, faktycznie przetestowany restore, kompletna polityka retencji artefaktów. Nie oznacza to, że tych mechanizmów nie ma; oznacza, że nie zostały zweryfikowane w tym repozytoryjnym audycie.

**REKOMENDACJA:** przy wznowieniu wydań wykonać jedną bounded akceptację dostawy: obraz i produkty o znanych digestach, exact merged-main identity, health/readiness, działający prosty user journey oraz przećwiczony rollback. Nie zastępować tym zwykłego CI ani nie wykonywać pełnej macierzy E2E na Synology jako substytutu hostowanych testów.

## 15. Kolejność działań i kryteria zakończenia

Poniższe kroki są planem, nie rozpoczętą implementacją. Nie utworzono dla nich PR-ów ani nie zmieniono ustawień.

| Etap | Zakres | Kryterium zakończenia | Ważna granica |
|---|---|---|---|
| 1. Uzgodnienie stanu | Istniejący dokument maintenance, właściwe sekcje AGENTS, bieżące podsumowanie #315 | Opis odpowiada trzem workflow i rzeczywistemu required check; #326 nie jest ponownie traktowany jako pending | Bez nowego registry i bez przywracania testów |
| 2. Rozstrzygnięcie kontroli | A01, A02 i plan A06 | Wąski zakres usuwania testów; jednolita kontrola typów w przyszłym przejściu; jawny mechanizm zmiany zamrożonego gate’u | Osobna authority, ciągłość PR/MQ, brak ogólnego bypassu |
| 3. Porządek wejścia | Aktywne prompty i onboarding | Krótki kontrakt zadania, poprawna hierarchia, brak historycznego programu udającego current dispatch | README nie jest obecnie dozwolony przez zwykły gate |
| 4. Kontrakty danych | A03 i A04 | Błędne dane odrzucone przed publikacją; transfer przerywany po limicie; regresje producent–konsument | Zmiany produktu dopiero w autoryzowanej fazie po freeze |
| 5. Weryfikacja shadow | Małe grupy deterministyczne, potem bounded browser | Rzeczywiste positive/negative canary; właściwe exact SHA i expected test identity; pomiary kosztu | Bez automatycznego odtwarzania wszystkich 25 workflow |
| 6. Gotowość wydania | Uzgodnione silniki przeglądarek, UX, publikacja, rollback | Dowód produktu na właściwej rewizji i kontrolowana dostawa | Historyczny green ani green maintenance nie wystarcza |

Dla równoległej pracy rozsądne są niezależne, read-only lub dokumentacyjne zadania o rozłącznych plikach. Zmiana samej kontroli integracji powinna mieć jednego odpowiedzialnego właściciela i jasno określoną kolejność. W audycie nie uruchamiano subagentów i nie przypisuje się im żadnych wyników.

## 16. Brakujące dane i ich wpływ na decyzję

| Brakujące dane | Wpływ |
|---|---|
| Pełny checkout oraz pełne uruchomienie testów/buildów z badanego SHA | Nie można potwierdzić całego produktu lub kompilacji tylko na podstawie tej sesji |
| Aktualny census, mapowanie każdego E2E do minimalnej capability, dane o flaky runs | Nie można uznać selektora za kompletny ani podać kosztu/usuwalności każdej grupy |
| Pełna treść wszystkich legacy kontrolerów i procesu generowania oracles | Nie można wskazać całego minimalnego zestawu plików do usunięcia bez dodatkowej analizy |
| Działająca aplikacja i obejrzane full-frame evidence | Brak akceptacji wizualnej i ergonomicznej |
| Live host, nagłówki, obraz, wolumeny, restore drill | Brak potwierdzenia bieżącego wdrożenia i odzyskiwania |
| CVE/SBOM, skan historii sekretów, ustawienia protected environments | Brak kompletnej oceny supply chain i konfiguracji bezpieczeństwa |
| Organization audit log, wszystkie uprawnienia aplikacji i zespołów | Nie można odtworzyć wszystkich operacji administracyjnych ani certyfikować całej organizacji |
| Pełna konfiguracja agentów i pomiary token/czas | Brak liczbowej oceny kosztów promptów i effort |

## 17. Podstawa końcowej decyzji

Odczytany `main` i rzeczywisty run MQ potwierdzają działającą integrację maintenance. Treść źródeł i eksperymenty potwierdzają trzy grupy rozbieżności walidacji oraz problem limitowania odpowiedzi po buforowaniu. Stan #326 pokazuje, że istotna część uproszczenia instrukcji jest już scalona. Nie ma natomiast wykonanego tutaj pełnego dowodu akceptacji produktu z obecnego SHA.

**REKOMENDACJA KOŃCOWA:** kontynuować kontrolowany maintenance, zabezpieczyć zachowanie istotnych testów, uzgodnić bieżące instrukcje i przygotować proste, autoryzowane wyjście z freeze. Następnie naprawiać kontrakty i przywracać tylko uzasadnione grupy weryfikacji, zaczynając od shadow i bounded fixtures. Nie przepisywać całego Atlasa, nie przywracać hurtowo starego CI i nie utożsamiać zielonego gate’u integracyjnego z gotowością produktu.

---

## Załącznik A — indeks dowodów

Wszystkie ścieżki kodu poniżej odnoszą się do `Oteryn/Oteryn-Atlas@51623c7dab2346cee39cd51e3caa845bf4b65426`, chyba że podano inny SHA. „Pełny” oznacza odczyt treści pliku, nie wykonanie całego modułu. „Inwentarz” oznacza metadane drzewa; nie należy traktować go jako przeglądu wszystkich linii.

| ID | Źródło i zakres |
|---|---|
| S01 | GitHub `branches/main`, odczyt początkowy i końcowy; SHA, drzewo, commit #341 |
| S02 | Root tree `8d5b8f1…` oraz odczytane poddrzewa docs, web, tools, e2e, src; duże odpowiedzi częściowo obcięte, bez deklaracji pełnego census |
| S03 | `AGENTS.md`, blob `53531fdb74563899fb7fb1389509b9a9ec3d9271`; odczyt główny i uzupełniający m.in. linii 75–151 |
| S04 | GitHub rulesets `22103758` i `22352928`, pełne odczyty konfiguracji |
| S05 | Trzy aktywne `.github/workflows/*.yml`, pełne; reusable Platform wskazane, ich treści nie audytowano w całości |
| S06 | Actions run `34040534843`, head `51623c7…`, merge_group/success; job `101506348064`, odczyt kroków |
| S07 | Issue #315, opis i wybrane najnowsze komentarze, w tym `5559343094` i `5559782784` |
| S08 | `tools/maintenance/verify-maintenance-diff.mjs`, pełny; blob `714fb73fe08b7c741d606c6e5a8ecdf33a3adf10`; kopia uruchomiona lokalnie |
| S09 | `docs/maintenance/suspended-workflows/`, inwentarz 25 plików i rozmiarów |
| S10 | PR #326, pełne metadane; merged, merge SHA `9755e31513c7949035b4d446ab9132880dac80e1` |
| S11 | `docs/agents/DOCUMENTATION_AGENT_IA.md`, pełny; blob `ec18423a9f0145beeda2aa024ee1293cad48f824` |
| S12 | Actions run `34033820190`, head `d0e2f143ae678c97c0657cdd8e446725ab0a11f3`; job `101488141779`, odczyt kroków; historyczny success |
| S13 | `README.md`, pełny; blob `fd2d076275ec16ad8a03eb68efd683c173b8d498` |
| S14 | `src/browser/fullworld-trust.mjs`, pełny; blob `e2a788657d92e0e641dad5627f12416507700055` |
| S15 | `src/browser/loader.mjs`, pełny; blob `2f56433f797b4178e28d7bf1cbf86487ac2832e8` |
| S16 | `src/browser/creature-publication-source.mjs`, pełny; blob `0f44da17c30a61089b0cec1c110d8411fedc8f94` |
| S17 | `web/` i `tools/`, inwentarz plików; centralne moduły UI nie zostały przeczytane w całości |
| S18 | Code search potwierdzający `tests/verification/bounded-real-world.test.mjs` i jego fragmenty; nie uruchomiono tego testu |
| S19 | `tools/build-creature-index.py`, pełny; blob `325c63b22b5b75797af7ecb47f1aaae5f577657f`; kopia uruchomiona lokalnie |
| S20 | `docs/maintenance/ATLAS-MAINTENANCE-MODE.md`, pełny; blob `e2991bca6b63d8b494fbea66a430b1ad2e62a8b3`; aktualny tryb 100644 |
| S21 | `src/browser/creature-search.mjs`, linie 1–90; blob `e732c6478251f476f09750687dadfb38799b521a` |
| S22 | `web/fullworld-creatures.mjs`, linie 1–170; blob `38f61d9e0cf232851ce624904d52dc661c36d7c2` |
| S23 | `.github/CODEOWNERS`, pełny; blob `e3e59db55ac2b97068aae54a805373fc1261eee5` |
| S24 | `e2e/package.json`, pełny; lockfile potwierdzony inwentarzem, bez pełnego audytu zależności przechodnich |
| S25 | `tools/verification/`, inwentarz i wybrane wyniki code search; niepełna inspekcja historycznych kontrolerów |
| S26 | `e2e/playwright.config.mjs`, pełny; blob `9f7ff4b73235644e679d1b7b21ac6eb68a96fb7d` |
| S27 | `e2e/tests/geometry-desktop.spec.mjs`, pełny; blob `3788a0342eeb95f2827f44028724eda8973139b8` |
| S28 | `e2e/support/geometry-oracle.mjs`, pełny; blob `5d09792cc8e74a7b744f53347fddc7ab76626a8f` |
| S29 | `e2e/tests/accessibility-desktop.spec.mjs`, pełny; blob `c9a4be3b70d52beca43d9fcc3d8b48883dc6a926` |
| S30 | GitHub search otwartych PR, w tym #141; nie przeprowadzono pełnego review wszystkich otwartych diffów |
| S31 | `e2e/tests/`, inwentarz plików; pozostałe scenariusze nie są objęte pełnym line-by-line review |
| S32 | `e2e/Dockerfile` i `e2e/Dockerfile.web`, pełne; bloby `c0d2684a775e7f9507395dedfb1dc6bb5f0e0fbb` i `9e16117759a4bbb4483305aa71187af8d1105ad8` |
| S33 | `e2e/nginx/default.conf.template`, pełny; blob `b3bd65e8a145e0ba1074dc03fa168999d00d7f0c` |
| S34 | `docs/maintenance/suspended-workflows/ci.yml`, linie 1–180; blob `d9189ae8ad5619b8607e050f77254a879cfbfaf9` |
| S35 | GitHub code search filename AGENTS.md / AGENTS.override.md; odpowiednio 1 i 0 wyników |
| S36 | `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`, linie 1–130; blob `168ea109c8d0a4fbb4af459dc4735ec029d1e79d` |
| S37 | `src/browser/fullworld-runtime-v0.md`, pełny; blob `d672c56cb51371738b51e4610400c39de8be2720`; dokument, nie wynik aktualnego profilowania |
| S38 | `SECURITY.md`, pełny; blob `ea4873e3d730ab5d20ff911c812176b0d5d2548d` |
| S39 | `.github/dependabot.yml`, pełny; blob `e6dd67b7dc2135bfc608189cb36f4a041c8704a0` |
| S40 | Obie deklaracje `docs/legal/DYN-ATLAS-001-*-asset-rights-attestation.md`, pełne; deklaracje właściciela, nie niezależny certyfikat praw |
| P01 | `results/maintenance-probes.json` i `.log`; 33 wykonane próby, 29 zgodnych z oczekiwaniem, 4 rozbieżności |
| P02 | `results/creature-builder-probes.json` i `.log`; 11 wykonanych prób, 8 zgodnych z oczekiwaniem, 3 rozbieżności |

## Załącznik B — odtwarzanie eksperymentów

Odtwarzanie prób gate’u wymaga środowiska Linux/WSL z obsługą symlinków i trybów plików Git, Python 3 oraz Node 22. Skrypty nie wymagają sieci, tokenu GitHub ani uprawnień do repozytorium organizacji. Tworzą i usuwają własne tymczasowe katalogi oraz zapisują lokalne wyniki w `results/`.

```bash
python probe_maintenance.py
python probe_creature_builder.py
```

Przed wykonaniem każdy skrypt sprawdza identyczność swojego pliku źródłowego z Git blob SHA podanym przez GitHub. Oryginalnych źródeł nie poprawiano. Próby celowo dokumentują rozbieżności: zakończenie skryptu audytowego nie oznacza, że wszystkie kontrole są poprawne. Właściwym wynikiem są pola oczekiwania/obserwacji w JSON i podsumowanie logu.

Raport oraz skrypty są lokalnymi artefaktami audytu. Nie zostały zapisane do gałęzi repozytorium, nie stanowią PR-a ani zintegrowanej poprawki.
