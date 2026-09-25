const express = require('express');
const mongoose = require('mongoose');
const Expense = require('../models/Expense');

const router = express.Router();
const ALLOWED = ['title', 'amount', 'category', 'date', 'paymentMethod', 'note'];

// Keep only known fields (blocks unexpected data being written to the DB)
const pick = (body) => Object.fromEntries(Object.entries(body || {}).filter(([k]) => ALLOWED.includes(k)));
const monthRange = (month) => {
  const [y, m] = String(month).split('-').map(Number);
  return y && m ? { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) } : null;
};
const checkId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Invalid expense id' });

// GET /api/expenses?month=2026-09&category=Food&search=tea
router.get('/', async (req, res, next) => {
  try {
    const { month, category, search } = req.query;
    const filter = {};
    const range = month && monthRange(month);
    if (range) filter.date = range;
    if (category && category !== 'All') filter.category = String(category);
    if (search) filter.title = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    res.json(await Expense.find(filter).sort({ date: -1, createdAt: -1 }));
  } catch (err) { next(err); }
});

// GET /api/expenses/summary?month=2026-09  -> totals per category (aggregation pipeline)
router.get('/summary', async (req, res, next) => {
  try {
    const range = req.query.month && monthRange(req.query.month);
    const byCategory = await Expense.aggregate([
      { $match: range ? { date: range } : {} },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ total: byCategory.reduce((s, c) => s + c.total, 0), byCategory });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await Expense.create(pick(req.body))); } catch (err) { next(err); }
});

router.put('/:id', checkId, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) { next(err); }
});

router.delete('/:id', checkId, async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

module.exports = router;
