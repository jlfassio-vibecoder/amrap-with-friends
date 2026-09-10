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
  brooks2018: {
    id: 'brooks2018',
    authors: 'Brooks GA',
    year: 2018,
    title: 'The science and translation of lactate shuttle theory',
    source: 'Cell Metabolism, 27(4), 757–785',
    url: 'https://doi.org/10.1016/j.cmet.2018.03.008',
    note: 'Comprehensive review by the researcher who proposed the shuttle. The standard reference.',
  },
  robergs2004: {
    id: 'robergs2004',
    authors: 'Robergs RA, Ghiasvand F, Parker D',
    year: 2004,
    title: 'Biochemistry of exercise-induced metabolic acidosis',
    source:
      'American Journal of Physiology — Regulatory, Integrative and Comparative Physiology, 287(3), R502–R516',
    url: 'https://doi.org/10.1152/ajpregu.00114.2004',
    note: 'Argues lactate production does not cause acidosis. Influential and heavily cited — and contested; see the Point:Counterpoint below.',
  },
  pointCounterpoint2008: {
    id: 'pointCounterpoint2008',
    authors: 'Journal of Applied Physiology Point:Counterpoint',
    year: 2008,
    title:
      'Point:Counterpoint: Lactic acid is/is not the only physicochemical contributor to the acidosis of exercise',
    source: 'Journal of Applied Physiology, 105(1), 357–362',
    url: 'https://doi.org/10.1152/japplphysiol.00162.2008',
    note: 'The formal published disagreement. Cited here because the biochemistry is genuinely unsettled, not to pick a side.',
  },
  schwane1983: {
    id: 'schwane1983',
    authors: 'Schwane JA, Watrous BG, Johnson SR, Armstrong RB',
    year: 1983,
    title: 'Is lactic acid related to delayed-onset muscle soreness?',
    source: 'The Physician and Sportsmedicine, 11(3), 124–131',
    url: 'https://doi.org/10.1080/00913847.1983.11708485',
    note: 'The dissociation experiment: level running raised lactate without soreness, downhill running caused soreness without raising it.',
  },
  ulmer1996: {
    id: 'ulmer1996',
    authors: 'Ulmer HV',
    year: 1996,
    title:
      'Concept of an extracellular regulation of muscular metabolic rate during heavy exercise in humans by psychophysiological feedback',
    source: 'Experientia, 52(5), 416–420',
    url: 'https://doi.org/10.1007/BF01919309',
    note: 'The paper that named teleoanticipation — pacing regulated against a known endpoint.',
  },
  abbiss2008: {
    id: 'abbiss2008',
    authors: 'Abbiss CR, Laursen PB',
    year: 2008,
    title: 'Describing and understanding pacing strategies during athletic competition',
    source: 'Sports Medicine, 38(3), 239–252',
    url: 'https://doi.org/10.2165/00007256-200838030-00004',
    note: 'Narrative review defining the pacing taxonomy still in use. Descriptive, not a trial.',
  },
  ramosCampo2025: {
    id: 'ramosCampo2025',
    authors: 'Ramos-Campo DJ, et al.',
    year: 2025,
    title:
      'Comparative effects of pacing strategies on endurance performance: a systematic review and network meta-analysis',
    source: 'Sports Medicine',
    url: 'https://doi.org/10.1007/s40279-025-02367-3',
    note: 'The best current synthesis, and it finds no universally superior imposed strategy. Cited here because it complicates the case, not because it supports it.',
  },
  noakes2012: {
    id: 'noakes2012',
    authors: 'Noakes TD',
    year: 2012,
    title:
      'Fatigue is a brain-derived emotion that regulates the exercise behavior to ensure the protection of whole body homeostasis',
    source: 'Frontiers in Physiology, 3, 82',
    url: 'https://doi.org/10.3389/fphys.2012.00082',
    note: 'Statement of the central governor model by its principal author. Influential and disputed.',
  },
  shephard2009: {
    id: 'shephard2009',
    authors: 'Shephard RJ',
    year: 2009,
    title: "Is it time to retire the 'central governor'?",
    source: 'Sports Medicine, 39(9), 709–721',
    url: 'https://doi.org/10.2165/11315130-000000000-00000',
    note: 'The published rebuttal. Included so the model is not presented as settled.',
  },
  terra2021: {
    id: 'terra2021',
    authors: 'Terra A, Paulucio D, Machado M, Bishop DJ, Koch AJ, Alvarenga R, Pompeu FAMS',
    year: 2021,
    title:
      'Effect of unaware clock manipulation on pacing strategy and performance in recreational athletes',
    source: 'Applied Sciences, 11(17), 8062',
    url: 'https://doi.org/10.3390/app11178062',
    note: 'Ten recreationally active subjects, 60-minute trials with manipulated time feedback.',
  },
  barbaRuiz2024: {
    id: 'barbaRuiz2024',
    authors:
      'Barba-Ruíz M, Hermosilla-Perona F, Heredia-Elvar JR, Gómez-González N, Da Silva-Grigoletto ME, Muriarte-Solana D',
    year: 2024,
    title:
      'Muscular performance analysis in "cross" modalities: comparison between "AMRAP," "EMOM" and "RFT" configurations',
    source: 'Frontiers in Physiology, 15, 1358191',
    url: 'https://doi.org/10.3389/fphys.2024.1358191',
    note: 'Twelve athletes (10 men, 2 women) performing the same work under three formats. Small, and the only direct format comparison of its kind.',
  },
  mateMunoz2017: {
    id: 'mateMunoz2017',
    authors: 'Maté-Muñoz JL, et al.',
    year: 2017,
    title: 'Muscular fatigue in response to different modalities of CrossFit sessions',
    source: 'PLOS ONE, 12(7), e0181855',
    url: 'https://doi.org/10.1371/journal.pone.0181855',
    note: '34 subjects, three workout types including a 20-minute AMRAP. Jump testing before, during and after.',
  },
  dech2022: {
    id: 'dech2022',
    authors: 'Dech S, Bittmann FN, Schaefer LV',
    year: 2022,
    title:
      'Muscle oxygenation and time to task failure of submaximal holding and pulling isometric muscle actions and influence of intermittent voluntary muscle twitches',
    source: 'BMC Sports Science, Medicine and Rehabilitation, 14',
    url: 'https://doi.org/10.1186/s13102-022-00447-9',
    note: 'Twelve subjects, elbow flexors only, 60% of maximal torque. A tightly controlled lab task, not a workout.',
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
