const express = require('express');
const router = express.Router();
const Module = require('../models/Module');

// Obtenir tous les modules
router.get('/', async (req, res) => {
    try {
        const modules = await Module.find().populate('specialite').sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir un module par ID
router.get('/:id', async (req, res) => {
    try {
        const module = await Module.findById(req.params.id).populate('specialite');
        if (!module) {
            return res.status(404).json({ message: 'Module non trouvé' });
        }
        res.json(module);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les modules par spécialité
router.get('/specialite/:specialiteId', async (req, res) => {
    try {
        const modules = await Module.find({ specialite: req.params.specialiteId }).sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les modules par spécialité et semestre
router.get('/specialite/:specialiteId/semestre/:semestre', async (req, res) => {
    try {
        const modules = await Module.find({
            specialite: req.params.specialiteId,
            semestre: parseInt(req.params.semestre)
        }).sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 