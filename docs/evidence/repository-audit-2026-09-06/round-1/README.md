# Pakiet dowodowy audytu Oteryn Atlas

Otwórz `REPORT.html` w przeglądarce lub `REPORT.md` w edytorze Markdown.

`audit-manifest.json` jest jawnym zestawieniem odczytanych obserwacji, nie surowym zrzutem API.
`sources/` zawiera dwie niezmienione kopie plików repozytorium. Ich Git blob SHA są weryfikowane przez skrypty przed wykonaniem.
`results/` zawiera faktyczne logi i JSON z wykonanych prób.
`SHA256SUMS` opisuje integralność plików pakietu, nie podpis zewnętrznego audytora.

## Odtwarzanie

Linux/WSL, Git, Python 3 i Node 22. Testy symlinków/trybów Git wymagają semantyki POSIX. Badanie przeprowadzono na Python 3.13.5, Node 22.16.0 i Git 2.47.3.

```bash
python probe_maintenance.py
python probe_creature_builder.py
```

Skrypty tworzą wyłącznie własne lokalne fixture i nie łączą się z GitHub. Syntetyczne commity z wyników nie należą do repozytorium organizacji.

33 próby gate’u: 29 zgodnych z oczekiwaniem, 4 rozbieżności.
11 prób generatora: 8 zgodnych z oczekiwaniem, 3 rozbieżności.

Skrypty mają charakter diagnostyczny: ukończenie procesu nie oznacza bezbłędności badanego produktu. Należy odczytać pola oczekiwania i wyniku. Nie zastępują istniejącego CI, pełnego builda, E2E ani akceptacji wizualnej.

Nie zmieniono repozytorium, workflow, ustawień, PR-ów, gałęzi ani wdrożenia. Naprawy w raporcie są rekomendacjami, nie wdrożonym kodem.
