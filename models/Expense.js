const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0.01 },
    category: {
      type: String,
      required: true,
      enum: ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'],
    },
    date: { type: Date, required: true },
    paymentMethod: { type: String, enum: ['Cash', 'UPI', 'Card', 'Net Banking'], default: 'UPI' },
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
