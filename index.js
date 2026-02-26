require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/user.models.js");
const Attendance = require("./models/attendance.models.js");
const Payroll = require("./models/payroll.models.js");

const app = express();

app.use(express.json());

app.use(cors()); 

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

app.get("/", (req, res) => {
  res.send("Hello from Node API");
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(200).json({
      success: true,
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/attendance/start", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id; // 🔥 From JWT

    const officeLat = 22.720576;
    const officeLng = 88.504019;

    const today = new Date().toISOString().split("T")[0];

    const alreadyMarked = await Attendance.findOne({
      userId,
      date: today,
    });

    if (alreadyMarked) {
      return res.status(400).json({
        success: false,
        message: "Attendance already marked today",
      });
    }

    const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = getDistanceFromLatLonInKm(
      latitude,
      longitude,
      officeLat,
      officeLng
    );

    if (distance > 1) {
      return res.status(400).json({
        success: false,
        message: "You are outside office radius (1km)",
      });
    }

    const attendance = await Attendance.create({
      userId,
      latitude,
      longitude,
      date: today,
      startTime: new Date(),
      stopTime: null,
    });

    res.status(200).json({
      success: true,
      message: "Attendance started successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/attendance/stop", authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const userId = req.user.id;

    const officeLat = 22.720576;
    const officeLng = 88.504019;

    const today = new Date().toISOString().split("T")[0];

    const attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "You have not started attendance today",
      });
    }

    if (attendance.stopTime) {
      return res.status(400).json({
        success: false,
        message: "Attendance already stopped today",
      });
    }

    const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = getDistanceFromLatLonInKm(
      latitude,
      longitude,
      officeLat,
      officeLng
    );

    if (distance > 1) {
      return res.status(400).json({
        success: false,
        message: "You are outside office radius (1km)",
      });
    }

    attendance.stopTime = new Date();
    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance stopped successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/attendance/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 15;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filter = { userId };

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const total = await Attendance.countDocuments(filter);

    const records = await Attendance.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    const formattedData = records.map((record, index) => {
      let workingMinutes = 0;
      let overtimeMinutes = 0;
      let lateMinutes = 0;
      let deductionDay = "0.00";
      let status = "absent";

      if (record.startTime && record.stopTime) {
        const diffMs =
          new Date(record.stopTime) - new Date(record.startTime);

        workingMinutes = Math.floor(diffMs / 60000);

        if (workingMinutes > 480) {
          overtimeMinutes = workingMinutes - 480;
        }

        const officeStart = new Date(record.date + "T10:00:00");
        const checkIn = new Date(record.startTime);

        if (checkIn > officeStart) {
          lateMinutes = Math.floor(
            (checkIn - officeStart) / 60000
          );
        }

        if (workingMinutes < 240) {
          deductionDay = "0.50";
        }

        status = "present";
      }

      return {
        id: record._id,
        user_id: record.userId,
        office_id: "1",
        date: record.date,
        status,
        check_in: record.startTime,
        check_out: record.stopTime,
        working_minutes: workingMinutes.toString(),
        overtime_minutes: overtimeMinutes.toString(),
        late_minutes: lateMinutes.toString(),
        deduction_day: deductionDay,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };
    });

    const lastPage = Math.ceil(total / perPage);

    const baseUrl = `${req.protocol}://${req.get("host")}/api/attendance/history`;

    res.status(200).json({
      success: true,
      data: {
        current_page: page,
        data: formattedData,
        first_page_url: `${baseUrl}?page=1`,
        from: (page - 1) * perPage + 1,
        last_page: lastPage,
        last_page_url: `${baseUrl}?page=${lastPage}`,
        links: [
          {
            url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
            label: "« Previous",
            active: false,
          },
          {
            url: `${baseUrl}?page=${page}`,
            label: page.toString(),
            active: true,
          },
          {
            url:
              page < lastPage
                ? `${baseUrl}?page=${page + 1}`
                : null,
            label: "Next »",
            active: false,
          },
        ],
        next_page_url:
          page < lastPage
            ? `${baseUrl}?page=${page + 1}`
            : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url:
          page > 1
            ? `${baseUrl}?page=${page - 1}`
            : null,
        to: (page - 1) * perPage + formattedData.length,
        total: total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/payroll", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const month = req.query.month;
    const year = req.query.year;

    const filter = { userId };

    if (month) filter.month = month;
    if (year) filter.year = year;

    const total = await Payroll.countDocuments(filter);

    const records = await Payroll.find(filter)
      .sort({ year: -1, month: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage);

    const formattedData = records.map((record) => ({
      id: record._id,
      user_id: record.userId,
      office_id: record.officeId,
      month: record.month,
      year: record.year,
      working_days: record.workingDays,
      leave_days: record.leaveDays,
      late_deduction_days: record.lateDeductionDays,
      ot_hours: record.otHours,
      ot_amount: record.otAmount,
      gross_salary: record.grossSalary,
      advance: record.advance,
      provident_fund: record.providentFund,
      esi: record.esi,
      professional_tax: record.professionalTax,
      total_deductions: record.totalDeductions,
      net_salary: record.netSalary,
      processed: record.processed,
      paid: record.paid,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    }));

    const lastPage = Math.ceil(total / perPage);
    const baseUrl = `${req.protocol}://${req.get("host")}/api/payroll`;

    res.status(200).json({
      success: true,
      message: "Payroll list fetched successfully",
      data: {
        current_page: page,
        data: formattedData,
        first_page_url: `${baseUrl}?page=1`,
        from: total === 0 ? null : (page - 1) * perPage + 1,
        last_page: lastPage,
        last_page_url: `${baseUrl}?page=${lastPage}`,
        links: [
          {
            url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
            label: "« Previous",
            active: false,
          },
          {
            url: `${baseUrl}?page=${page}`,
            label: page.toString(),
            active: true,
          },
          {
            url: page < lastPage ? `${baseUrl}?page=${page + 1}` : null,
            label: "Next »",
            active: false,
          },
        ],
        next_page_url:
          page < lastPage ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page: perPage,
        prev_page_url:
          page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to:
          total === 0
            ? null
            : (page - 1) * perPage + formattedData.length,
        total: total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/payroll/create", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month, year, gross_salary, advance } = req.body;

    const grossSalary = parseFloat(gross_salary);
    const advanceAmount = parseFloat(advance || 0);

    const existingPayroll = await Payroll.findOne({
      userId,
      month,
      year,
    });

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: "Payroll already created for this month",
      });
    }


    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const attendances = await Attendance.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
    });

    let workingDays = 0;
    let lateDeductionDays = 0;
    let totalOtMinutes = 0;

    attendances.forEach((record) => {
      if (record.startTime && record.stopTime) {
        workingDays++;

        const diffMs =
          new Date(record.stopTime) - new Date(record.startTime);

        const workingMinutes = Math.floor(diffMs / 60000);

        if (workingMinutes > 480) {
          totalOtMinutes += workingMinutes - 480;
        }

        const officeStart = new Date(record.date + "T10:00:00");
        const checkIn = new Date(record.startTime);

        if (checkIn > officeStart) {
          lateDeductionDays += 0.5;
        }
      }
    });

    const otHours = (totalOtMinutes / 60).toFixed(2);

    const perDaySalary = grossSalary / 30;
    const perHourSalary = perDaySalary / 8;
    const otAmount = (perHourSalary * otHours).toFixed(2);

    const providentFund = (grossSalary * 0.12).toFixed(2);
    const esi = (grossSalary * 0.0075).toFixed(2);
    const professionalTax = "130.00";

    const lateDeductionAmount =
      (perDaySalary * lateDeductionDays).toFixed(2);

    const totalDeductions = (
      parseFloat(providentFund) +
      parseFloat(esi) +
      parseFloat(professionalTax) +
      parseFloat(lateDeductionAmount) +
      advanceAmount
    ).toFixed(2);

    const netSalary = (
      grossSalary +
      parseFloat(otAmount) -
      parseFloat(totalDeductions)
    ).toFixed(2);

    const payroll = await Payroll.create({
      userId,
      officeId: "1",
      month,
      year,
      workingDays: workingDays.toString(),
      leaveDays: "0",
      lateDeductionDays: lateDeductionDays.toFixed(2),
      otHours: otHours.toString(),
      otAmount: otAmount.toString(),
      grossSalary: grossSalary.toFixed(2),
      advance: advanceAmount.toFixed(2),
      providentFund,
      esi,
      professionalTax,
      totalDeductions,
      netSalary,
      processed: "1",
      paid: "0",
    });

    res.status(200).json({
      success: true,
      message: "Payroll created successfully",
      data: payroll,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/attendance/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    const record = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!record) {
      return res.status(200).json({
        attendance_started: false,
        check_in: null,
        check_out: null,
        working_minutes: "0",
        overtime_minutes: "0",
        late_minutes: "0",
        deduction_day: "0.00",
      });
    }

    let workingMinutes = 0;
    let overtimeMinutes = 0;
    let lateMinutes = 0;
    let deductionDay = "0.00";

    if (record.startTime && record.stopTime) {
      const diffMs =
        new Date(record.stopTime) - new Date(record.startTime);

      workingMinutes = Math.floor(diffMs / 60000);

      if (workingMinutes > 480) {
        overtimeMinutes = workingMinutes - 480;
      }

      const officeStart = new Date(record.date + "T10:00:00");
      const checkIn = new Date(record.startTime);

      if (checkIn > officeStart) {
        lateMinutes = Math.floor(
          (checkIn - officeStart) / 60000
        );
      }

      if (workingMinutes < 240) {
        deductionDay = "0.50";
      }
    }

    res.status(200).json({
      attendance_started: true,
      check_in: record.startTime,
      check_out: record.stopTime,
      working_minutes: workingMinutes.toString(),
      overtime_minutes: overtimeMinutes.toString(),
      late_minutes: lateMinutes.toString(),
      deduction_day: deductionDay,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
/* ================= MONGODB ================= */
// mongoose
//   .connect(
//     "mongodb+srv://kabir_db_user:TvjIiTVEbSqdjmVG@backenddb.r6udfyt.mongodb.net/?appName=BackendDB",
//   ) 
// //mongodb+srv://kabir_db_user:TvjIiTVEbSqdjmVG@backenddb.r6udfyt.mongodb.net/officePortal?retryWrites=true&w=majority
//   //mongodb+srv://kabir_db_user:TvjIiTVEbSqdjmVG@backenddb.r6udfyt.mongodb.net/?appName=BackendDB
//   .then(() => {
//     console.log("Connected!");
//     app.listen(3000, () => {
//       console.log("Server is running on port 3000");
//     });
//   })
//   .catch(() => {
//     console.log("Connection failed");
//   });
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully!");

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB Connection Failed:", err.message);
  });
