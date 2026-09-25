const mongoose = require('mongoose');

// One budget document per month, e.g. month = "2026-09"
const budgetSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}$/ },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Budget', budgetSchema);
