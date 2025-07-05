// @ts-ignore
import pdf from 'pdf-parse';


export interface HealthReportData {
  name?: string;
  age?: number;
  gender?: string;
  patientId?: string;
  heartPattern?: string;
  bmi?: string;
  bloodPressure?: string;
  bloodGlucose?: string;
  cholesterol?: string;
  liverFunction?: string;
  sleepPattern?: string;
  oxygenSaturation?: string;
}

export async function parseHealthReportPdf(fileBuffer: Buffer): Promise<HealthReportData> {
  const data = await pdf(fileBuffer);
  const text = data.text;

  // Helper to extract a field by label
  function extractField(label: string, text: string): string | undefined {
    const regex = new RegExp(label + ':\s*([\w\- ]+)', 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
  }

  return {
    name: extractField('Name', text),
    age: extractField('Age', text) ? parseInt(extractField('Age', text)!, 10) : undefined,
    gender: extractField('Gender', text),
    patientId: extractField('Patient ID', text),
    heartPattern: extractField('Heart Pattern', text),
    bmi: extractField('BMI', text),
    bloodPressure: extractField('Blood Pressure', text),
    bloodGlucose: extractField('Blood Glucose', text),
    cholesterol: extractField('Cholesterol', text),
    liverFunction: extractField('Liver Function', text),
    sleepPattern: extractField('Sleep Pattern', text),
    oxygenSaturation: extractField('Oxygen Saturation', text),
  };
}

function hashHealthReportJson(report: any): string {
  // Canonicalize the JSON (sort keys for consistency)
  const canonical = JSON.stringify(report, Object.keys(report).sort());
  // Convert to hex, then to BigInt for Poseidon
  const hex = Buffer.from(canonical).toString('hex');
  const hashBigInt = poseidon([BigInt('0x' + hex)]);
  return hashBigInt.toString();
}