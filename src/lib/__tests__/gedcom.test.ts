import { describe, it, expect } from 'vitest';
import { parseGedcom } from '../gedcom-parser';
import { serializeGedcomWithReport } from '../gedcom-serializer';

describe('Interopérabilité et Tests GEDCOM (P1 - Exigence 5)', () => {
  const sampleGedcomRaw = `0 HEAD
1 SOUR Genealogor
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @S1@ SOUR
1 TITL Registre Paroissial Saint-Vincent
1 AUTH Curé de Saint-Malo
0 @I1@ INDI
1 NAME François /Martin/
1 GIVN François
1 SURN Martin
1 SEX M
1 BIRT
2 DATE 14 MAY 1742
2 PLAC Saint-Malo, Ille-et-Vilaine
2 SOUR @S1@
1 DEAT
2 DATE 04 FEB 1818
2 PLAC Rennes
1 FAMS @F1@
1 NOTE Première ligne de note.
2 CONT Deuxième ligne de note.
0 @I2@ INDI
1 NAME Marie /Laurent/
1 GIVN Marie
1 SURN Laurent
1 SEX F
1 BIRT
2 DATE 15 APR 1766
1 FAMS @F1@
0 @I3@ INDI
1 NAME Jean-Baptiste /Martin/
1 GIVN Jean-Baptiste
1 SURN Martin
1 SEX M
1 BIRT
2 DATE 12 MAR 1795
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 18 BRUMAIRE AN II
2 PLAC Rennes
0 TRLR`;

  it('doit analyser correctement les individus, familles, sources et notes multilignes (CONT)', () => {
    const data = parseGedcom(sampleGedcomRaw);

    expect(Object.keys(data.individuals).length).toBe(3);
    expect(Object.keys(data.families).length).toBe(1);
    expect(data.sources?.['@S1@']?.title).toBe('Registre Paroissial Saint-Vincent');

    const francois = data.individuals['@I1@'];
    expect(francois.name).toBe('François Martin');
    expect(francois.birth?.date).toBe('14 MAY 1742');
    expect(francois.notes?.[0]).toContain('Première ligne de note.\nDeuxième ligne de note.');
  });

  it('doit préserver les données lors d\'un cycle import -> export -> import (Round-trip)', () => {
    const parsed1 = parseGedcom(sampleGedcomRaw);
    const { gedcom: exportedGedcom } = serializeGedcomWithReport(parsed1);
    const parsed2 = parseGedcom(exportedGedcom);

    expect(Object.keys(parsed2.individuals).length).toBe(Object.keys(parsed1.individuals).length);
    expect(Object.keys(parsed2.families).length).toBe(Object.keys(parsed1.families).length);

    expect(parsed2.individuals['@I1@'].name).toBe(parsed1.individuals['@I1@'].name);
    expect(parsed2.individuals['@I1@'].birth?.date).toBe(parsed1.individuals['@I1@'].birth?.date);
    expect(parsed2.families['@F1@'].childrenIds).toEqual(parsed1.families['@F1@'].childrenIds);
  });

  it('doit masquer les personnes vivantes lors de l\'export si l\'option hideLiving est activée', () => {
    const currentYear = new Date().getFullYear();
    const livingYear = currentYear - 25;
    const gedcomWithLiving = `0 HEAD
1 SOUR Genealogor
0 @I99@ INDI
1 NAME Thomas /Martin/
1 GIVN Thomas
1 SURN Martin
1 SEX M
1 BIRT
2 DATE 10 OCT ${livingYear}
0 TRLR`;

    const data = parseGedcom(gedcomWithLiving);
    const { gedcom: exportedGedcom, report } = serializeGedcomWithReport(data, { hideLiving: true });

    expect(report.maskedLivingCount).toBe(1);
    expect(exportedGedcom).toContain('Martin [Privé]');
    expect(exportedGedcom).not.toContain('Thomas');
  });
});
