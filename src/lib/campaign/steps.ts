/**
 * Bear Pipeline — Campaign Step Config
 * Maps step numbers to SendGrid dynamic template IDs.
 */

export type StepConfig = {
  templateId: string;
  description: string;
};

const MAX_STEPS = 10;

const STEP_TEMPLATES: Record<number, StepConfig> = {
  1: { templateId: 'd-492ef1b22e4b47fdb3bb36e567aa2a14', description: 'Quick question about brokerage' },
  2: { templateId: 'd-4685ca5779b843c3b4548c210ef5579d', description: 'The math does not work' },
  3: { templateId: 'd-af0df40e114d4faaad7c61d54139cdbc', description: 'You do not need more training' },
  4: { templateId: 'd-5b7c242d136b49ab9c162e934950605e', description: 'The quiet trap' },
  5: { templateId: 'd-dc53472c61884c0caed9f4867e4e93fa', description: 'Why you have not broken past 10 deals' },
  6: { templateId: 'd-fbc60e32ffc647e9b88fb37638c37f64', description: 'If nothing changes' },
  7: { templateId: 'd-c0b58daf7fd74f1bb7cb8eaddee26829', description: 'Should I close your file (optional closer)' },
};

export function getStepConfig(
  step: number,
  firstName: string = 'there',
  brokerage: string = 'your brokerage'
): { templateId: string; dynamicTemplateData: Record<string, string> } {
  if (step < 1 || step > MAX_STEPS) {
    throw new Error(`Invalid step: ${step}. Must be between 1 and ${MAX_STEPS}.`);
  }
  const config = STEP_TEMPLATES[step];
  if (!config) {
    throw new Error(`Step ${step} is not yet configured.`);
  }
  return {
    templateId: config.templateId,
    dynamicTemplateData: { first_name: firstName, brokerage },
  };
}

export { MAX_STEPS };
