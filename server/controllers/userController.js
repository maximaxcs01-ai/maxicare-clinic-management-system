const service = require("../services/userService");

const listUsers = async (req, res, next) => { try { res.json(await service.listUsers(req.query)); } catch (e) { next(e); } };
const getUser = async (req, res, next) => { try { const data = await service.getUser(req.params.id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ data }); } catch (e) { next(e); } };
const createUser = async (req, res, next) => { try { const data = await service.createUser(req.validatedUser); res.status(201).json({ message: "Staff account created successfully", data }); } catch (e) { next(e); } };
const updateUser = async (req, res, next) => { try { const data = await service.updateUser(req.params.id, req.validatedUser); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User updated successfully", data }); } catch (e) { next(e); } };
const updateStatus = async (req, res, next) => { try { const data = await service.updateStatus(req.params.id, req.validatedStatus, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User status updated successfully", data }); } catch (e) { next(e); } };
const updateRole = async (req, res, next) => { try { const data = await service.updateRole(req.params.id, req.validatedRole, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User role updated successfully", data }); } catch (e) { next(e); } };
const deleteUser = async (req, res, next) => { try { const data = await service.deleteUser(req.params.id, req.user._id); if (!data) return res.status(404).json({ message: "User not found" }); res.json({ message: "User deleted successfully" }); } catch (e) { next(e); } };

module.exports = { listUsers, getUser, createUser, updateUser, updateStatus, updateRole, deleteUser };
