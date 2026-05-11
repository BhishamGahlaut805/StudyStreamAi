class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const removeFields = [
      "page",
      "sort",
      "sortBy",
      "limit",
      "fields",
      "q",
      "search",
    ];

    removeFields.forEach((field) => delete queryObj[field]);

    Object.keys(queryObj).forEach((key) => {
      const value = queryObj[key];

      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === "all"
      ) {
        delete queryObj[key];
      }
    });

    if (queryObj.price !== undefined) {
      if (queryObj.price === "free") {
        queryObj.price = 0;
      } else if (queryObj.price === "paid") {
        queryObj.price = { gt: 0 };
      } else {
        const price = Number(queryObj.price);
        if (Number.isNaN(price)) {
          delete queryObj.price;
        } else {
          queryObj.price = price;
        }
      }
    }

    if (queryObj.level === "all") {
      delete queryObj.level;
    }

    if (queryObj.category === "all") {
      delete queryObj.category;
    }

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`,
    );

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  search() {
    const searchTerm = this.queryString.q || this.queryString.search;

    if (searchTerm) {
      this.query = this.query.find({
        $text: { $search: searchTerm },
      });
    }

    return this;
  }

  sort() {
    const sortValue = this.queryString.sort || this.queryString.sortBy;

    if (sortValue) {
      const sortBy = sortValue.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }

    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    }

    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

module.exports = APIFeatures;
