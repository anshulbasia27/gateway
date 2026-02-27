import Ajv from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  removeAdditional: 'all',
});

ajv.addKeyword('exclusiveMinimum');

export function validateSchema(data: any, schema: object): boolean {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    console.error(validate.errors);
  }
  return valid;
}
