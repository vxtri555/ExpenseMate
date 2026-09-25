const express = require('express');
const Budget = require('../models/Budget');

const router = express.Router();
const validMonth = (req, res, next) =>
  /^\d{4}-\d{2}$/.test(req.params.month) ? next() : res.status(400).json({ error: 'Month must be YYYY-MM' });

// GET /api/budget/2026-09
router.get('/:month', validMonth, async (req, res, next) => {
  try {
    const budget = await Budget.findOne({ month: req.params.month });
    res.json(budget || { month: req.params.month, amount: 0 });
  } catch (err) { next(err); }
});

// PUT /api/budget/2026-09  { "amount": 6000 }
router.put('/:month', validMonth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!(amount >= 0)) return res.status(400).json({ error: 'Amount must be a positive number' });
    const budget = await Budget.findOneAndUpdate(
      { month: req.params.month }, { amount }, { new: true, upsert: true, runValidators: true }
    );
    res.json(budget);
  } catch (err) { next(err); }
});

module.exports = router;
