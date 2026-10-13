import { GenealogyData, Individual, Family } from '../types/genealogy';

export function serializeGedcom(data: GenealogyData): string {
  const lines: string[] = [];

  // Header
  lines.push('0 HEAD');
  lines.push('1 SOUR Genealogor');
  lines.push('2 VERS 2.0');
  lines.push('2 NAME Genealogor — Arbre Familial & Archives');
  lines.push('1 DATE ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase());
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');

  // Individuals
  for (const indi of Object.values(data.individuals)) {
    lines.push(`0 ${indi.id} INDI`);
    const surnamePart = indi.surname ? `/${indi.surname}/` : '';
    const givenPart = indi.givenName || '';
    const nameLine = [givenPart, surnamePart].filter(Boolean).join(' ').trim() || indi.name || 'Inconnu';
    lines.push(`1 NAME ${nameLine}`);
    if (indi.givenName) lines.push(`2 GIVN ${indi.givenName}`);
    if (indi.surname) lines.push(`2 SURN ${indi.surname}`);
    lines.push(`1 SEX ${indi.sex || 'X'}`);

    if (indi.birth) {
      lines.push('1 BIRT');
      if (indi.birth.date) lines.push(`2 DATE ${indi.birth.date}`);
      if (indi.birth.place) lines.push(`2 PLAC ${indi.birth.place}`);
    }
    if (indi.baptism) {
      lines.push('1 BAPM');
      if (indi.baptism.date) lines.push(`2 DATE ${indi.baptism.date}`);
      if (indi.baptism.place) lines.push(`2 PLAC ${indi.baptism.place}`);
    }
    if (indi.death) {
      lines.push('1 DEAT');
      if (indi.death.date) lines.push(`2 DATE ${indi.death.date}`);
      if (indi.death.place) lines.push(`2 PLAC ${indi.death.place}`);
    }
    if (indi.burial) {
      lines.push('1 BURI');
      if (indi.burial.date) lines.push(`2 DATE ${indi.burial.date}`);
      if (indi.burial.place) lines.push(`2 PLAC ${indi.burial.place}`);
    }

    if (indi.occupations) {
      for (const occ of indi.occupations) {
        lines.push(`1 OCCU ${occ}`);
      }
    }

    for (const famc of indi.familiesAsChild) {
      lines.push(`1 FAMC ${famc}`);
    }
    for (const fams of indi.familiesAsSpouse) {
      lines.push(`1 FAMS ${fams}`);
    }

    if (indi.notes) {
      for (const note of indi.notes) {
        lines.push(`1 NOTE ${note}`);
      }
    }
  }

  // Families
  for (const fam of Object.values(data.families)) {
    lines.push(`0 ${fam.id} FAM`);
    if (fam.husbandId) lines.push(`1 HUSB ${fam.husbandId}`);
    if (fam.wifeId) lines.push(`1 WIFE ${fam.wifeId}`);

    for (const childId of fam.childrenIds) {
      lines.push(`1 CHIL ${childId}`);
    }

    if (fam.marriage) {
      lines.push('1 MARR');
      if (fam.marriage.date) lines.push(`2 DATE ${fam.marriage.date}`);
      if (fam.marriage.place) lines.push(`2 PLAC ${fam.marriage.place}`);
    }
    if (fam.divorce) {
      lines.push('1 DIV');
      if (fam.divorce.date) lines.push(`2 DATE ${fam.divorce.date}`);
    }

    if (fam.notes) {
      for (const note of fam.notes) {
        lines.push(`1 NOTE ${note}`);
      }
    }
  }

  lines.push('0 TRLR');
  return lines.join('\n');
}
