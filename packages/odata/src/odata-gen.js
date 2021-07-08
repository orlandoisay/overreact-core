const { generateODataSchema } = require('./schema/generate-odata-schema');
const { exportSchemaModel } = require('./schema/export-schema-model');
const { EDM } = require('./edm/core');
const { resIdsPlugin } = require('./edm/resource-identifiers');
const { defineConstProperty } = require('./edm/reflection');

const {
  createSpecMetadata,
  createOverreactSchema,

  specMetadataScope,
  specMetadataType,
} = require('./bundler/create-spec-metadata');
const { schemaNameMapper } = require('./bundler/utils');

async function makeSpecMetadata(config) {
  const {
    url,
    rootPropertyName,
    rootPropertyModelName,
    schemaExtensions,
  } = config;

  const namespaces = await generateODataSchema(url, {
    isByDefaultNullable(ref) {
      if (ref === 'Edm/String') {
        return true;
      }

      return !ref.startsWith('Edm') && !ref.startsWith('Enum');
    },
    withEnumValue: false,
  });

  const model = exportSchemaModel(namespaces);

  Object.keys(model || {}).forEach(key => {
    Object.assign(model[key], { $$ref: key });
  });

  const edm = new EDM({
    schemas: {
      $ROOT: {
        $$ref: '$ROOT',
        type: 'object',
        properties: {
          [rootPropertyName]: {
            type: 'array',
            items: model[rootPropertyModelName],
          },
        },
        $$ODataExtension: {
          Name: '$ROOT',
          NavigationProperty: [
            rootPropertyName,
          ],
        },
      },
      ...model,
    },
  });

  resIdsPlugin(edm);

  const root = edm.types.resolve('$ROOT');

  const rootResourceIdentifier = new root.ResourceIdentifier();
  defineConstProperty(edm, 'root', rootResourceIdentifier);
  defineConstProperty(edm, rootPropertyName, rootResourceIdentifier[rootPropertyName]);

  const overreactSchema = createOverreactSchema(edm, schemaNameMapper, {
    // TODO: also needs to be customizable
    disapproved_campaign: 'Model/McaCampaign',
  });

  const specsMetadata = createSpecMetadata(
    edm,
    overreactSchema,
    model[rootPropertyModelName],
    schemaNameMapper,
    [{
      name: rootPropertyName,
      schema: model[rootPropertyModelName],
    }],
    {},
  );

  return specsMetadata;
}

module.exports = {
  makeSpecMetadata,

  specMetadataScope,
  specMetadataType,
};
