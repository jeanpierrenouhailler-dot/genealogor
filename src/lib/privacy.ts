import { GenealogyData, Individual } from '../types/genealogy';

export type VitalStatus = 'deceased' | 'probably_alive' | 'unknown';

export interface PrivacyPolicy {
  hideLiving: boolean;
  hideUnknown: boolean;
  maskExactDates?: boolean;
  maskPlaces?: boolean;
  maskNotes?: boolean;
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  hideLiving: true,
  hideUnknown: true,
  maskExactDates: true,
  maskPlaces: true,
  maskNotes: true,
};

/**
 * Détermine le statut vital d'un individu de façon conservatrice.
 * Une absence de date de décès ne signifie PAS que la personne est décédée.
 */
export function determineVitalStatus(person: Individual, data?: GenealogyData): VitalStatus {
  // 1. Décès ou sépulture documenté
  if (person.death && (person.death.date || person.death.place || person.death.parsedDate?.year)) {
    return 'deceased';
  }
  if (person.burial && (person.burial.date || person.burial.place || person.burial.parsedDate?.year)) {
    return 'deceased';
  }

  const currentYear = new Date().getFullYear();

  // 2. Date de naissance disponible
  if (person.birth?.parsedDate?.year) {
    const age = currentYear - person.birth.parsedDate.year;
    if (age < 100) {
      return 'probably_alive';
    }
    return 'deceased';
  }

  // 3. Déduction contextuelle via les parents, conjoints et enfants si les données sont fournies
  if (data) {
    // Vérifier les parents
    for (const famId of person.familiesAsChild) {
      const fam = data.families[famId];
      if (fam) {
        const father = fam.husbandId ? data.individuals[fam.husbandId] : null;
        const mother = fam.wifeId ? data.individuals[fam.wifeId] : null;

        const fatherBirth = father?.birth?.parsedDate?.year;
        const motherBirth = mother?.birth?.parsedDate?.year;

        // Si les parents sont nés il y a moins de 120 ans, l'enfant est très probablement vivant
        if ((fatherBirth && currentYear - fatherBirth < 120) || (motherBirth && currentYear - motherBirth < 120)) {
          return 'probably_alive';
        }

        // Si les parents sont nés il y a plus de 160 ans, la personne est certainement décédée
        if ((fatherBirth && currentYear - fatherBirth > 160) || (motherBirth && currentYear - motherBirth > 160)) {
          return 'deceased';
        }
      }
    }

    // Vérifier les enfants
    for (const famId of person.familiesAsSpouse) {
      const fam = data.families[famId];
      if (fam) {
        for (const childId of fam.childrenIds) {
          const child = data.individuals[childId];
          const childBirth = child?.birth?.parsedDate?.year;
          // Si un enfant est né il y a moins de 80 ans, le parent peut être vivant
          if (childBirth && currentYear - childBirth < 80) {
            return 'probably_alive';
          }
        }
      }
    }
  }

  // 4. Sans aucune information probante, le statut reste inconnu (traité comme protégé par prudence)
  return 'unknown';
}

export function isLiving(person: Individual, data?: GenealogyData): boolean {
  const status = determineVitalStatus(person, data);
  return status === 'probably_alive';
}

export function shouldProtectPerson(person: Individual, policy: PrivacyPolicy = DEFAULT_PRIVACY_POLICY, data?: GenealogyData): boolean {
  const status = determineVitalStatus(person, data);
  if (status === 'deceased') return false;
  if (status === 'probably_alive' && policy.hideLiving) return true;
  if (status === 'unknown' && policy.hideUnknown) return true;
  return false;
}

/**
 * Masque et anonymise de façon étanche les données sensibles d'un individu protégé.
 */
export function sanitizePersonForPrivacy(person: Individual, policy: PrivacyPolicy = DEFAULT_PRIVACY_POLICY, data?: GenealogyData): Individual {
  if (!shouldProtectPerson(person, policy, data)) {
    return person;
  }

  const birthYear = person.birth?.parsedDate?.year;

  return {
    ...person,
    name: person.surname ? `${person.surname} [Privé]` : '[Confidentiel]',
    givenName: '[Confidentiel]',
    surname: person.surname || '[Confidentiel]',
    birth: birthYear ? {
      parsedDate: { raw: `${birthYear}`, year: birthYear },
      date: `${birthYear}`,
      place: policy.maskPlaces ? undefined : person.birth?.place,
    } : undefined,
    death: undefined,
    baptism: undefined,
    burial: undefined,
    occupations: [],
    residences: [],
    notes: ['Données masquées conformément à la politique de confidentialité des personnes vivantes.'],
  };
}
