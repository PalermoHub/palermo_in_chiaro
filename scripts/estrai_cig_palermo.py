"""Estrae dai file ANAC CIG (zip mensili) le righe del Comune di Palermo (CF 80016350821).
Uso: python3 -I scripts/estrai_cig_palermo.py <cartella_zip> <file_output.csv>
Nessun valore viene modificato."""
import csv, glob, io, os, sys, zipfile
csv.field_size_limit(10**9)
CF = '80016350821'
src, out = sys.argv[1], sys.argv[2]
tot = n = 0
w = None
with open(out, 'w', encoding='utf-8', newline='') as o:
    for z in sorted(glob.glob(os.path.join(src, '*.zip'))):
        with zipfile.ZipFile(z) as zf:
            for name in zf.namelist():
                with zf.open(name) as raw:
                    r = csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''), delimiter=';')
                    if w is None:
                        w = csv.DictWriter(o, fieldnames=['file_origine'] + r.fieldnames, delimiter=';'); w.writeheader()
                    k = 0
                    for row in r:
                        tot += 1
                        if row['cf_amministrazione_appaltante'].strip() == CF:
                            row['file_origine'] = os.path.basename(z); w.writerow(row); n += 1; k += 1
                    print(os.path.basename(z), name, 'righe Palermo:', k, flush=True)
print('totale righe lette', tot, 'righe Palermo', n)
