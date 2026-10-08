const { recordAudit } = require('../utils/audit');

// Mongoose plugin: adds CREATE / UPDATE / DELETE audit logging to a schema
// using pre/post hooks. Apply with: schema.plugin(auditPlugin, { entity: 'Patient' })
module.exports = function auditPlugin(schema, { entity }) {
  schema.pre('save', function () {
    this.$locals.wasNew = this.isNew;
    this.$locals.changed = this.isNew ? [] : this.modifiedPaths();
  });

  schema.post('save', async function (doc) {
    await recordAudit({
      action: doc.$locals.wasNew ? 'CREATE' : 'UPDATE',
      entity,
      entityId: doc._id,
      changedFields: doc.$locals.changed,
    });
  });

  schema.post('findOneAndUpdate', async function (doc) {
    if (!doc) return;
    const update = this.getUpdate() || {};
    const fields = new Set();
    Object.entries(update).forEach(([key, value]) => {
      if (key.startsWith('$')) Object.keys(value || {}).forEach((f) => fields.add(f));
      else fields.add(key);
    });
    await recordAudit({ action: 'UPDATE', entity, entityId: doc._id, changedFields: [...fields] });
  });

  schema.post('findOneAndDelete', async function (doc) {
    if (!doc) return;
    await recordAudit({ action: 'DELETE', entity, entityId: doc._id });
  });
};
