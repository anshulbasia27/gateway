import { validateSchema } from '../schemaValidator';

const schema = {
  type: 'object',
  properties: {
    value: { type: 'number', exclusiveMinimum: 0 },
  },
  additionalProperties: false,
};

describe('Schema Validator', () => {
  it('should pass validation with valid data', () => {
    const data = { value: 1 };
    expect(validateSchema(data, schema)).toBe(true);
  });

  it('should fail validation with invalid data', () => {
    const data = { value: 0 };
    expect(validateSchema(data, schema)).toBe(false);
  });

  it('should ignore unknown properties', () => {
    const data = { value: 1, unknown: 'test' };
    expect(validateSchema(data, schema)).toBe(true);
  });
});
