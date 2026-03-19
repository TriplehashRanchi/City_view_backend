const clientModel = require("../models/clientModel");

exports.createClient = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    await clientModel.createClient(name, phone, email);

    res.json({
      success: true,
      message: "Client created successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getClients = async (req, res) => {
  try {
    const clients = await clientModel.getClients();

    res.json({
      success: true,
      data: clients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
