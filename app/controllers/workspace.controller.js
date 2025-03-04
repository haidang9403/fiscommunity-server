const createError = require("http-errors");
const config = require("../config");
const prisma = require("../services/prisma");

const workspaceController = {
    // Create workspace
    create: async (req, res, next) => {
        try {
            const { conversationId } = req.params;
            const { name, description } = req.body;
            if (!name && !conversationId) {
                return next(createError(400, "Missing name or conversationId"))
            }
            const userId = req.payload.aud;
            const workspace = await prisma.workspace.create({
                data: {
                    name,
                    description,
                    userId: parseInt(userId),
                    conversationId: parseInt(conversationId)
                },
            })

            if (!workspace) return next(createError(500, "Error when creating workspace"))

            res.status(200).json(workspace)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Edit workspace
    edit: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;
            const { name, description } = req.body;

            let dataUpdate = {}

            if (name) dataUpdate.name = name
            if (description) dataUpdate.description = description

            const workspaceUpdated = await prisma.workspace.update({
                where: {
                    id: parseInt(workspaceId)
                },
                data: {
                    ...dataUpdate
                }
            })

            res.status(200).json(workspaceUpdated)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Close workspace
    close: async (req, res, next) => {
        try {
            const { workspaceId } = req.params;

            if (!workspaceId) return next(createError(400, "Missing workspaceId"))
            const workspaceUpdated = await prisma.workspace.update({
                where: {
                    id: parseInt(workspaceId)
                },
                data: {
                    isOpen: false
                }
            })

            res.status(200).json(workspaceUpdated)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    },
    // Get workspace
    getList: async (req, res, next) => {
        try {
            const userId = req.payload.aud;
            const { conversationId } = req.params;
            const { isOpen } = req.query;
            const workspaceList = await prisma.workspace.findMany({
                where: {
                    conversationId: parseInt(conversationId),
                    isOpen: isOpen == "true" ? true : false
                },
                orderBy: {
                    createdAt: "desc"
                }
            })

            res.status(201).json(workspaceList)
        } catch (e) {
            console.log(e)
            next(createError(500))
        }
    }
}

module.exports = workspaceController