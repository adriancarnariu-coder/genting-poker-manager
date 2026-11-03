# Genting Poker Manager

Prima versiune a aplicației de administrare a turneelor de poker, cu interfață în limba română.

## Pornire

Necesită Node.js 22 sau mai nou. Nu sunt necesare pachete externe sau chei API.

```sh
npm start
```

Deschide `http://localhost:3000` în browser. `PORT` și `HOST` pot configura serverul; implicit ascultă doar pe `127.0.0.1`. Pentru acces printr-un mediu găzduit, configurează `HOST=0.0.0.0` și port forwarding-ul mediului.

```sh
npm test
```

## Flux de lucru

1. Creează un turneu cu nume și dată.
2. Adaugă flight-uri (de exemplu Ziua 1A, Ziua 1B).
3. Adaugă jucători cu nume, cod de țară din două litere, flight și stack pentru Ziua 2.
4. Editează stackurile, caută jucători și filtrează după flight.
5. Exportă clasamentul complet în CSV. Clasamentul este descrescător, cu locuri comune pentru stackuri egale.

Datele se salvează automat în localStorage, separat pentru fiecare turneu. Sunt păstrate la reîncărcare în același browser și aceeași origine. Stackul zero este permis; media include toți jucătorii înregistrați. Fiecare rând reprezintă o înscriere; identitatea jucătorilor între flight-uri nu este deduplicată automat.

## Limitele primei versiuni

Fără autentificare, sincronizare între calculatoare sau bază de date pe server. Datele nu sunt transmise serverului. Ștergerea datelor browserului le elimină; exportul CSV permite păstrarea clasamentului, dar importul nu este implementat. Evită utilizarea simultană în mai multe file; aplicația blochează salvarea când detectează modificări într-o altă filă. Nu folosi această versiune ca singura evidență a unui turneu real.

## Publicare online cu GitHub Pages

În GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
Workflow-ul `.github/workflows/pages.yml` testează aplicația și publică folderul `public` la fiecare push pe `main`. După activare, rulează workflow-ul **Deploy demo to GitHub Pages** din fila **Actions** dacă prima execuție a eșuat. Linkul live apare în **Settings → Pages** după publicarea reușită.

Este o demonstrație publică, fără autentificare. Fiecare vizitator are propria copie a datelor în browser. Nu introduce date personale reale pentru demonstrații. Disponibilitatea și eventualele costuri GitHub Pages depind de plan și de vizibilitatea repository-ului; nu este necesar să faci repository-ul public pentru această pregătire.
