// Marcas (brands): the symbols of the platforms people link to and share on, adapted to Gota's
// stroke (docs/taxonomy.md, decision 81). Never a wordmark. Every brand turns off the slash, and the
// marks belong to their owners (TRADEMARKS.md): Gota's license covers only its drawings.
//
// Flouvia's own marks come first and are not drawings: `brand-flouvia` (the isotype, the drop with
// the u) and `brand-flouvia-u` (the u on its own) are traced from Flouvia's official logo by an
// exact scale and shift, never redrawn, and `mark` keeps them solid and unchanged in every style
// and weight. Isotype: its box (81.27–679.13 × 201.1–799 in the logo's canvas) to 18, centered;
// the u: its box (153.41–604.1 × 342.94–717.41) to 18 wide, centered. Don't edit these two.

const FLOUVIA_DROP = 'M21 11.79L21 11.73C20.85 6.76 16.7 2.85 11.73 3C6.76 3.15 2.85 7.3 3 12.26C3.14 17.13 7.13 20.98 11.96 21L21 21Z';
// The u inside the isotype, wound against the drop so the fill leaves it open
const FLOUVIA_U_IN = 'M18.74 18.54L15.43 18.54C7 18.5 5.38 14.36 5.19 10.26C5.18 10.16 5.17 10.07 5.17 9.97L5.18 9.9C5.17 9.87 5.17 9.84 5.18 9.8C5.27 8.37 6.55 7.27 8.12 7.27C9.67 7.27 10.94 8.38 11.06 9.79C11.32 11.51 10.33 17.66 15.43 16.9L15.43 10.1L18.74 10.1Z';
const FLOUVIA_U = 'M21 8.28L16.61 8.28L16.61 17.3C9.84 18.31 11.16 10.15 10.81 7.86C10.65 5.99 8.96 4.52 6.91 4.52C4.83 4.52 3.13 5.98 3.01 7.88C3 7.93 3 7.97 3 8.02L3 8.1C3 8.23 3.01 8.36 3.02 8.49C3.28 13.93 5.43 19.42 16.61 19.48L21 19.48Z';

const icons = {
  'brand-flouvia': {
    tags: ['flouvia', 'isotipo', 'logotipo', 'marca', 'estudio', 'isotype', 'logo', 'brand', 'studio'],
    d: [FLOUVIA_DROP, FLOUVIA_U_IN],
    fill: { solid: [`${FLOUVIA_DROP}${FLOUVIA_U_IN}`] },
    mark: true,
  },
  'brand-flouvia-u': {
    tags: ['flouvia', 'u', 'isotipo', 'marca', 'monograma', 'isotype', 'brand', 'monogram'],
    d: [FLOUVIA_U],
    fill: { solid: [FLOUVIA_U] },
    mark: true,
  },
};

// A brand is never slashed; Flouvia's marks, whole logos, take no enclosure either
for (const icon of Object.values(icons)) icon.variants = { ...icon.variants, slash: false };
for (const name of ['brand-flouvia', 'brand-flouvia-u']) icons[name].variants = { ...icons[name].variants, circle: false, square: false };

export default { category: 'marcas', label: 'Marcas', icons };
