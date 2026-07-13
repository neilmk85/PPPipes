export const UOM_OPTIONS = [
  { group: 'Count',   units: [{ value: 'pcs', label: 'Pieces (pcs)' }, { value: 'nos', label: 'Numbers (nos)' }, { value: 'unit', label: 'Unit' }, { value: 'pair', label: 'Pair' }, { value: 'set', label: 'Set' }, { value: 'dozen', label: 'Dozen' }, { value: 'pack', label: 'Pack' }, { value: 'box', label: 'Box' }, { value: 'carton', label: 'Carton' }, { value: 'bag', label: 'Bag' }, { value: 'roll', label: 'Roll' }, { value: 'strip', label: 'Strip' }] },
  { group: 'Weight',  units: [{ value: 'kg', label: 'Kilogram (kg)' }, { value: 'g', label: 'Gram (g)' }, { value: 'mg', label: 'Milligram (mg)' }, { value: 'mt', label: 'Metric Ton (MT)' }, { value: 'ton', label: 'Tonne (ton)' }, { value: 'lb', label: 'Pound (lb)' }, { value: 'oz', label: 'Ounce (oz)' }, { value: 'quintal', label: 'Quintal' }] },
  { group: 'Volume',  units: [{ value: 'l', label: 'Litre (l)' }, { value: 'ml', label: 'Millilitre (ml)' }, { value: 'cl', label: 'Centilitre (cl)' }, { value: 'brass', label: 'Brass' }] },
  { group: 'Length',  units: [{ value: 'm', label: 'Metre (m)' }, { value: 'cm', label: 'Centimetre (cm)' }, { value: 'mm', label: 'Millimetre (mm)' }, { value: 'ft', label: 'Feet (ft)' }, { value: 'in', label: 'Inch (in)' }, { value: 'yard', label: 'Yard' }] },
  { group: 'Area',    units: [{ value: 'sqm', label: 'Sq. Metre (sqm)' }, { value: 'sqft', label: 'Sq. Feet (sqft)' }] },
  { group: 'Service', units: [{ value: 'hr', label: 'Hour (hr)' }, { value: 'min', label: 'Minute (min)' }, { value: 'day', label: 'Day' }, { value: 'month', label: 'Month' }, { value: 'job', label: 'Job / Visit' }] },
]

/** Flat list of all unit values */
export const ALL_UNITS = UOM_OPTIONS.flatMap(g => g.units)
