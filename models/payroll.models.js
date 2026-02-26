// models/payroll.models.js
const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    officeId: { type: String, default: "1" },
    month: String,
    year: String,
    workingDays: String,
    leaveDays: String,
    lateDeductionDays: String,
    otHours: String,
    otAmount: String,
    grossSalary: String,
    advance: String,
    providentFund: String,
    esi: String,
    professionalTax: String,
    totalDeductions: String,
    netSalary: String,
    processed: String,
    paid: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);