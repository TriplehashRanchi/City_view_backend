const eventModel = require("../models/eventModel");
const { handleValidationErrors, parsePagination, toNullableString } = require("../utils/validation");

const safeError = (res, error) => {
  console.error(error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : "Server error",
  });
};

const resolveClientId = async ({ clientId, client, adminId }) => {
  if (clientId) {
    const existing = await eventModel.findClientById(clientId);
    if (!existing) {
      const error = new Error("Client not found");
      error.statusCode = 404;
      throw error;
    }
    return existing.id;
  }

  if (!client) {
    const error = new Error("Either clientId or client details are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = toNullableString(client.email)?.toLowerCase() || null;
  const normalizedPhone = toNullableString(client.phone);

  const existing = await eventModel.findClientByIdentity({ email: normalizedEmail, phone: normalizedPhone });
  if (existing) {
    await eventModel.updateClient(existing.id, {
      name: client.name.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      companyName: toNullableString(client.companyName),
      notes: toNullableString(client.notes),
      status: existing.status,
    });
    return existing.id;
  }

  return eventModel.createClient({
    name: client.name.trim(),
    phone: normalizedPhone,
    email: normalizedEmail,
    companyName: toNullableString(client.companyName),
    notes: toNullableString(client.notes),
    adminId,
  });
};

exports.createClient = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const clientId = await eventModel.createClient({
      name: req.body.name.trim(),
      phone: toNullableString(req.body.phone),
      email: toNullableString(req.body.email)?.toLowerCase() || null,
      companyName: toNullableString(req.body.companyName),
      notes: toNullableString(req.body.notes),
      adminId: req.admin.id,
    });

    const client = await eventModel.getClientDetails(clientId);
    return res.status(201).json({ success: true, message: "Client created", data: client });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getClients = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await eventModel.listClients({
      search: toNullableString(req.query.search),
      status: toNullableString(req.query.status),
      limit,
      offset,
    });

    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await eventModel.getClientDetails(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    return res.json({ success: true, data: client });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateClient = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await eventModel.findClientById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Client not found" });

    await eventModel.updateClient(req.params.id, {
      name: req.body.name.trim(),
      phone: toNullableString(req.body.phone),
      email: toNullableString(req.body.email)?.toLowerCase() || null,
      companyName: toNullableString(req.body.companyName),
      notes: toNullableString(req.body.notes),
      status: req.body.status || existing.status,
    });

    const client = await eventModel.getClientDetails(req.params.id);
    return res.json({ success: true, message: "Client updated", data: client });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.createEvent = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const clientId = await resolveClientId({
      clientId: req.body.clientId,
      client: req.body.client,
      adminId: req.admin.id,
    });

    const eventId = await eventModel.createEvent({
      clientId,
      occasionType: req.body.occasionType.trim(),
      eventDate: req.body.eventDate,
      startTime: req.body.startTime,
      endTime: toNullableString(req.body.endTime),
      guestCount: Number(req.body.guestCount),
      venue: req.body.venue.trim(),
      notes: toNullableString(req.body.notes),
      adminId: req.admin.id,
    });

    const eventRecord = await eventModel.getEventById(eventId);
    return res.status(201).json({ success: true, message: "Event created", data: eventRecord });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.listEvents = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await eventModel.listEvents({
      search: toNullableString(req.query.search),
      status: toNullableString(req.query.status),
      dateFrom: toNullableString(req.query.dateFrom),
      dateTo: toNullableString(req.query.dateTo),
      limit,
      offset,
    });

    return res.json({ success: true, data: result.rows, pagination: { page, limit, total: result.total } });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.getEvent = async (req, res) => {
  try {
    const eventRecord = await eventModel.getEventById(req.params.id);
    if (!eventRecord) return res.status(404).json({ success: false, message: "Event not found" });
    return res.json({ success: true, data: eventRecord });
  } catch (error) {
    return safeError(res, error);
  }
};

exports.updateEvent = async (req, res) => {
  const validationResponse = handleValidationErrors(req, res);
  if (validationResponse) return validationResponse;

  try {
    const existing = await eventModel.getEventById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Event not found" });

    const clientId = await resolveClientId({
      clientId: req.body.clientId || existing.client_id,
      client: req.body.client,
      adminId: req.admin.id,
    });

    await eventModel.updateEvent(req.params.id, {
      clientId,
      occasionType: req.body.occasionType.trim(),
      eventDate: req.body.eventDate,
      startTime: req.body.startTime,
      endTime: toNullableString(req.body.endTime),
      guestCount: Number(req.body.guestCount),
      venue: req.body.venue.trim(),
      notes: toNullableString(req.body.notes),
      eventStatus: req.body.eventStatus || existing.event_status,
    });

    const eventRecord = await eventModel.getEventById(req.params.id);
    return res.json({ success: true, message: "Event updated", data: eventRecord });
  } catch (error) {
    return safeError(res, error);
  }
};
