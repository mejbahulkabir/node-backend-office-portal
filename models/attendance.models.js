const mongoose = require("mongoose");

const AttendanceSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    latitude: {
      type: Number,
      required: true
    },

    longitude: {
      type: Number,
      required: true
    },

    date: {
      type: String,
      required: true
    },
    
    startTime: {
      type: Date,
      required: true
    },

    stopTime: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const Attendance = mongoose.model("Attendance", AttendanceSchema);

module.exports = Attendance;