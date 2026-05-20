const { validatePayload, parsePositiveInt } = require("../utils/validators");

class BaseController {
  constructor(service, config) {
    this.service = service;
    this.config = config;
  }

  list = async (req, res, next) => {
    try {
      const data = await this.service.list(req.auth);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      const item = await this.service.get(id, req.auth);
      if (!item) {
        return res.status(404).json({ message: `${this.config.label} not found.` });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const validationError = validatePayload(req.body, this.config.requiredFields);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const created = await this.service.create(req.body, req.auth);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      const validationError = validatePayload(req.body);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const updated = await this.service.update(id, req.body, req.auth);
      if (!updated) {
        return res.status(404).json({ message: `${this.config.label} not found.` });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req, res, next) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ message: "Invalid id." });
      }

      const removed = await this.service.remove(id, req.auth);
      if (!removed) {
        return res.status(404).json({ message: `${this.config.label} not found.` });
      }

      res.json({ message: `${this.config.label} deleted`, item: removed });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = BaseController;
