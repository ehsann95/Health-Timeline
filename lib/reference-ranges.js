// Curated normal ranges for common lab tests.
// Keys are lowercase, matched by "contains" against parsed test names.
const REFERENCE_RANGES = {
  // CBC
  "hemoglobin": { unit: "g/dL", low: 13, high: 17, category: "CBC" },
  "wbc": { unit: "/µL", low: 4000, high: 11000, category: "CBC" },
  "total leukocyte": { unit: "/µL", low: 4000, high: 11000, category: "CBC" },
  "platelet": { unit: "/µL", low: 150000, high: 450000, category: "CBC" },
  "rbc": { unit: "mill/cumm", low: 4.5, high: 5.5, category: "CBC" },
  "mcv": { unit: "fL", low: 80, high: 100, category: "CBC" },
  "mch": { unit: "pg", low: 27, high: 33, category: "CBC" },
  "mchc": { unit: "g/dL", low: 32, high: 36, category: "CBC" },
  "neutrophil": { unit: "%", low: 40, high: 75, category: "CBC" },
  "lymphocyte": { unit: "%", low: 20, high: 40, category: "CBC" },
  "eosinophil": { unit: "%", low: 1, high: 6, category: "CBC" },
  "esr": { unit: "mm/hr", low: 0, high: 20, category: "CBC" },

  // LFT
  "alt": { unit: "U/L", low: 7, high: 56, category: "LFT" },
  "sgpt": { unit: "U/L", low: 7, high: 56, category: "LFT" },
  "ast": { unit: "U/L", low: 10, high: 40, category: "LFT" },
  "sgot": { unit: "U/L", low: 10, high: 40, category: "LFT" },
  "bilirubin total": { unit: "mg/dL", low: 0.3, high: 1.2, category: "LFT" },
  "bilirubin direct": { unit: "mg/dL", low: 0.0, high: 0.3, category: "LFT" },
  "alkaline phosphatase": { unit: "U/L", low: 44, high: 147, category: "LFT" },
  "albumin": { unit: "g/dL", low: 3.5, high: 5.2, category: "LFT" },
  // Lipid
  "total cholesterol": { unit: "mg/dL", low: 0, high: 200, category: "Lipid" },
  "ldl": { unit: "mg/dL", low: 0, high: 100, category: "Lipid" },
  "hdl": { unit: "mg/dL", low: 40, high: 200, category: "Lipid" },
  "triglycerides": { unit: "mg/dL", low: 0, high: 150, category: "Lipid" },
  "vldl": { unit: "mg/dL", low: 0, high: 30, category: "Lipid" },

  // Blood sugar
  "fasting blood sugar": { unit: "mg/dL", low: 70, high: 100, category: "Blood Sugar" },
  "fbs": { unit: "mg/dL", low: 70, high: 100, category: "Blood Sugar" },
  "postprandial": { unit: "mg/dL", low: 70, high: 140, category: "Blood Sugar" },
  "ppbs": { unit: "mg/dL", low: 70, high: 140, category: "Blood Sugar" },
  "hba1c": { unit: "%", low: 4, high: 5.7, category: "Blood Sugar" },
  "random blood sugar": { unit: "mg/dL", low: 70, high: 140, category: "Blood Sugar" },

  // Thyroid
  "tsh": { unit: "µIU/mL", low: 0.4, high: 4.0, category: "Thyroid" },
  "t3": { unit: "ng/dL", low: 80, high: 200, category: "Thyroid" },
  "t4": { unit: "µg/dL", low: 5.1, high: 14.1, category: "Thyroid" },
  "free t4": { unit: "ng/dL", low: 0.8, high: 1.8, category: "Thyroid" },

  // Vitamins
  "vitamin d": { unit: "ng/mL", low: 30, high: 100, category: "Vitamins" },
  "25-hydroxy": { unit: "ng/mL", low: 30, high: 100, category: "Vitamins" },
  "vitamin b12": { unit: "pg/mL", low: 200, high: 900, category: "Vitamins" },

  // Iron / inflammation / cardiac
  "serum iron": { unit: "µg/dL", low: 60, high: 170, category: "Iron" },
  "ferritin": { unit: "ng/mL", low: 30, high: 400, category: "Iron" },
  "tibc": { unit: "µg/dL", low: 250, high: 450, category: "Iron" },
  "crp": { unit: "mg/L", low: 0, high: 5, category: "Inflammation" },
  "troponin": { unit: "ng/mL", low: 0, high: 0.04, category: "Cardiac" },
  "total protein": { unit: "g/dL", low: 6.4, high: 8.3, category: "LFT" },

  // KFT
  "creatinine": { unit: "mg/dL", low: 0.7, high: 1.3, category: "KFT" },
  "bun": { unit: "mg/dL", low: 7, high: 20, category: "KFT" },
  "urea": { unit: "mg/dL", low: 17, high: 43, category: "KFT" },
  "blood urea": { unit: "mg/dL", low: 17, high: 43, category: "KFT" },
  "uric acid": { unit: "mg/dL", low: 3.5, high: 7.2, category: "KFT" },
  "sodium": { unit: "mmol/L", low: 135, high: 145, category: "KFT" },
  "potassium": { unit: "mmol/L", low: 3.5, high: 5.1, category: "KFT" },
  "chloride": { unit: "mmol/L", low: 98, high: 107, category: "KFT" },
  "calcium": { unit: "mg/dL", low: 8.6, high: 10.3, category: "KFT" },
  "egfr": { unit: "mL/min", low: 90, high: 120, category: "KFT" },
  "gfr": { unit: "mL/min", low: 90, high: 120, category: "KFT" },
};


// Interpretation / summary rules — rule-based (free), pluggable with LLM later
const INTERPRETATIONS = {
  "alt": "Elevated ALT suggests liver cell stress — common causes: fatty liver, alcohol, medications, viral hepatitis.",
  "sgpt": "Elevated ALT (SGPT) suggests liver cell stress — common causes: fatty liver, alcohol, medications, viral hepatitis.",
  "ast": "Elevated AST may indicate liver or muscle involvement; often read together with ALT.",
  "sgot": "Elevated AST may indicate liver or muscle involvement; often read together with ALT.",
  "bilirubin total": "High bilirubin can cause jaundice; may indicate liver processing issues or red-cell breakdown.",
  "creatinine": "High creatinine can indicate reduced kidney filtration — correlate with eGFR and hydration.",
  "urea": "Elevated urea may reflect kidney function, dehydration, or high protein intake.",
  "uric acid": "High uric acid is associated with gout and kidney stones.",
  "hba1c": "HbA1c reflects average blood sugar over ~3 months; ≥5.7% suggests prediabetes, ≥6.5% diabetes.",
  "fasting blood sugar": "High fasting glucose suggests impaired glucose regulation / diabetes risk.",
  "fbs": "High fasting glucose suggests impaired glucose regulation / diabetes risk.",
  "tsh": "Abnormal TSH indicates thyroid dysfunction — high TSH suggests hypothyroidism, low TSH suggests hyperthyroidism.",
  "vitamin d": "Low vitamin D is very common; associated with bone health, fatigue, and muscle weakness.",
  "vitamin b12": "Low B12 can cause fatigue, nerve symptoms, and anemia; common with vegetarian diets or absorption issues.",
  "hemoglobin": "Low hemoglobin indicates anemia — check iron, B12, folate. High may indicate dehydration or polycythemia.",
  "platelet": "Low platelets raise bleeding risk; high may reflect inflammation or iron deficiency.",
  "ldl": "High LDL cholesterol contributes to atherosclerosis and cardiovascular risk.",
  "hdl": "Low HDL ('good cholesterol') increases cardiovascular risk.",
  "triglycerides": "High triglycerides are linked to metabolic syndrome, diet, and alcohol.",
  "total cholesterol": "High total cholesterol increases cardiovascular risk; interpret with LDL/HDL split.",
  "ferritin": "Low ferritin indicates depleted iron stores (iron deficiency).",
  "crp": "Elevated CRP indicates active inflammation/infection somewhere in the body.",
  "potassium": "Abnormal potassium can affect heart rhythm — clinically significant, review with a doctor.",
  "sodium": "Abnormal sodium affects fluid balance and neurology — review with a doctor.",
};

function lookupRange(name) {
  const lower = name.toLowerCase();
  for (const [key, range] of Object.entries(REFERENCE_RANGES)) {
    // Boundary match: "nRBC" must not match key "rbc", but "Neutrophils" still matches "neutrophil"
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("(^|[^a-z])" + escaped).test(lower)) return { key, ...range };
  }
  return null;
}

function classifyFlag(value, low, high) {
  if (low != null && value < low) return "LOW";
  if (high != null && value > high) return "HIGH";
  return "NORMAL";
}

module.exports = { REFERENCE_RANGES, INTERPRETATIONS, lookupRange, classifyFlag };
