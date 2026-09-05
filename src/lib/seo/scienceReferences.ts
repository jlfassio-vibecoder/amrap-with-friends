/**
 * Sources for the /science pages.
 *
 * One list, three consumers: the inline citation markers in the prose, the
 * reference list at the foot of the page, and the `citation` array in the
 * Article schema. A source cannot appear in one and not the others.
 *
 * The rule for these pages is that a claim ships with a citation or it does not
 * ship. Every entry below has been checked against the published record — title,
 * authors, journal, year and identifier. Do not add one that has not.
 */
export interface ScienceReference {
  /** Stable key used in the prose, e.g. `gastin2001`. */
  id: string;
  authors: string;
  year: number;
  title: string;
  /** Journal, volume and pages as they should be printed. */
  source: string;
  /** Canonical link — a DOI where one exists. */
  url: string;
  /** Shown beside the reference so a reader can judge the evidence, not just count it. */
  note: string;
}

export const SCIENCE_REFERENCES: Record<string, ScienceReference> = {
  gastin2001: {
    id: 'gastin2001',
    authors: 'Gastin PB',
    year: 2001,
    title: 'Energy system interaction and relative contribution during maximal exercise',
    source: 'Sports Medicine, 31(10), 725–741',
    url: 'https://doi.org/10.2165/00007256-200131100-00003',
    note: 'Narrative review. The paper the ~75-second crossover figure comes from.',
  },
  gastin2026: {
    id: 'gastin2026',
    authors: 'Gastin PB, Suppiah HT',
    year: 2026,
    title:
      'Anaerobic and aerobic energy system contribution during maximal exercise: a systematic review',
    source: 'Sports Medicine',
    url: 'https://doi.org/10.1007/s40279-026-02414-7',
    note: 'Systematic review of 102 studies and 311 data points. Revisits the 2001 estimate.',
  },
  rios2024: {
    id: 'rios2024',
    authors: 'Rios M, Becker KM, Cardoso F, Pyne DB, Reis VM, Moreira-Gonçalves D, Fernandes RJ',
    year: 2024,
    title:
      'Assessment of cardiorespiratory and metabolic contributions in an extreme intensity CrossFit benchmark workout',
    source: 'Sensors, 24(2), 513',
    url: 'https://doi.org/10.3390/s24020513',
    note: '14 highly trained male CrossFitters. Measures the three pathways directly, in a real workout.',
  },
  tibana2018: {
    id: 'tibana2018',
    authors: 'Tibana RA, de Sousa NMF, Prestes J, Voltarelli FA',
    year: 2018,
    title:
      'Lactate, heart rate and rating of perceived exertion responses to shorter and longer duration CrossFit training sessions',
    source: 'Journal of Functional Morphology and Kinesiology, 3(4), 60',
    url: 'https://doi.org/10.3390/jfmk3040060',
    note: 'Nine trained men, two sessions each. Small, but it is the direct duration comparison.',
  },
  kliszczewicz2014: {
    id: 'kliszczewicz2014',
    authors: 'Kliszczewicz B, Snarr RL, Esco M',
    year: 2014,
    title: "Metabolic and cardiovascular response to the CrossFit workout 'Cindy': a pilot study",
    source: 'Journal of Sport and Human Performance, 2(2), 1–9',
    url: 'https://jhp-ojs-tamucc.tdl.org/jhp/article/view/jshp.0038.2014',
    note: 'Pilot study, nine participants. The authors call it a pilot; treat the numbers as indicative.',
  },
  mangine2025: {
    id: 'mangine2025',
    authors:
      'Mangine GT, McGeehan KC, King W, Hines A, Henley JW, Grazer JL, Esmat TA, McLester JR',
    year: 2025,
    title:
      'Workout duration alters the importance of predictive traits on high-intensity functional training workout performance',
    source: 'Sports, 13(6), 156',
    url: 'https://doi.org/10.3390/sports13060156',
    note: '22 trained participants, the same circuit run for 5 and for 15 minutes.',
  },
  feito2018: {
    id: 'feito2018',
    authors: 'Feito Y, Heinrich KM, Butcher SJ, Poston WSC',
    year: 2018,
    title:
      'High-intensity functional training (HIFT): definition and research implications for improved fitness',
    source: 'Sports, 6(3), 76',
    url: 'https://doi.org/10.3390/sports6030076',
    note: 'The definitional paper separating HIFT from HIIT.',
  },
};

/** References for a page, in the order they should be numbered. */
export function referencesFor(ids: string[]): ScienceReference[] {
  return ids.map((id) => {
    const reference = SCIENCE_REFERENCES[id];
    if (!reference) {
      throw new Error(`Unknown science reference: ${id}`);
    }
    return reference;
  });
}
