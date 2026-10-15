import { describe, it, expect } from 'vitest';
import { parseGedcom, parseGedcomDate } from '../gedcom-parser';
import { serializeGedcomWithReport } from '../gedcom-serializer';

describe('Interopérabilité et Tests GEDCOM Multi-Logiciels (P1 - Exigence 5)', () => {
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

  it('gère les familles recomposées avec conjoints multiples et demi-frères/demi-sœurs', () => {
    const blendedGedcom = `0 HEAD
1 SOUR Heredis 2024
0 @I_FATHER@ INDI
1 NAME Henri /Martin/
1 SEX M
1 FAMS @FAM_1@
1 FAMS @FAM_2@
0 @I_WIFE1@ INDI
1 NAME Jeanne /Le Gall/
1 SEX F
1 FAMS @FAM_1@
0 @I_WIFE2@ INDI
1 NAME Louise /Moreau/
1 SEX F
1 FAMS @FAM_2@
0 @I_CHILD1@ INDI
1 NAME Pierre /Martin/
1 SEX M
1 FAMC @FAM_1@
0 @I_CHILD2@ INDI
1 NAME Suzanne /Martin/
1 SEX F
1 FAMC @FAM_2@
0 @FAM_1@ FAM
1 HUSB @I_FATHER@
1 WIFE @I_WIFE1@
1 CHIL @I_CHILD1@
0 @FAM_2@ FAM
1 HUSB @I_FATHER@
1 WIFE @I_WIFE2@
1 CHIL @I_CHILD2@
0 TRLR`;

    const parsed = parseGedcom(blendedGedcom);
    const father = parsed.individuals['@I_FATHER@'];
    expect(father.familiesAsSpouse).toEqual(['@FAM_1@', '@FAM_2@']);

    const child1 = parsed.individuals['@I_CHILD1@'];
    const child2 = parsed.individuals['@I_CHILD2@'];
    expect(child1.familiesAsChild).toContain('@FAM_1@');
    expect(child2.familiesAsChild).toContain('@FAM_2@');

    expect(parsed.families['@FAM_1@'].wifeId).toBe('@I_WIFE1@');
    expect(parsed.families['@FAM_2@'].wifeId).toBe('@I_WIFE2@');
  });

  it('analyse les dates approximatives en français et anglais (ABT, BET, VERS, AVANT, APRES)', () => {
    const d1 = parseGedcomDate('ABT 1820');
    expect(d1?.isApproximate).toBe(true);
    expect(d1?.year).toBe(1820);

    const d2 = parseGedcomDate('VERS 1785');
    expect(d2?.isApproximate).toBe(true);
    expect(d2?.year).toBe(1785);

    const d3 = parseGedcomDate('BET 1810 AND 1815');
    expect(d3?.isBetween).toBe(true);
    expect(d3?.year).toBe(1810);
    expect(d3?.year2).toBe(1815);

    const d4 = parseGedcomDate('AVANT 1850');
    expect(d4?.isBefore).toBe(true);
    expect(d4?.year).toBe(1850);

    const d5 = parseGedcomDate('APRES 1792');
    expect(d5?.isAfter).toBe(true);
    expect(d5?.year).toBe(1792);
  });

  it('extrait les médias (OBJE, FILE, TITL) et préserve les tags propriétaires (_UID, _FREL)', () => {
    const gedcomWithMediaAndVendorTags = `0 HEAD
1 SOUR Geneatique 2024
0 @I10@ INDI
1 NAME Alexandre /Dumas/
1 SEX M
1 OBJE
2 FILE portrait_dumas.jpg
2 TITL Portrait de l'écrivain
2 FORM jpg
1 _UID 4A91B0295F
1 _FREL Natural
0 TRLR`;

    const parsed = parseGedcom(gedcomWithMediaAndVendorTags);
    const dumas = parsed.individuals['@I10@'];

    expect(dumas.media?.length).toBe(1);
    expect(dumas.media?.[0].file).toBe('portrait_dumas.jpg');
    expect(dumas.media?.[0].title).toBe("Portrait de l'écrivain");
    expect(dumas.media?.[0].format).toBe('jpg');

    // Vérifier la préservation des tags non supportés sans perte silencieuse
    expect(dumas._unsupportedTags?.some(t => t.tag === '_UID')).toBe(true);
    expect(dumas._unsupportedTags?.some(t => t.tag === '_FREL')).toBe(true);
  });
});
