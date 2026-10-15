const { getPublicCatalog } = require("../services/publicCatalogService");

const getCatalog = async (_req, res, next) => {
  try {
    res.json({ data: await getPublicCatalog() });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCatalog };
