const prisma = require("../services/prisma");

async function logTaskHistory({ taskId, action, oldValue, newValue, userId }) {
    await prisma.taskHistory.create({
        data: {
            taskId: parseInt(taskId),
            action,
            oldValue,
            newValue,
            userId: parseInt(userId) // Người thực hiện thao tác
        }
    });
}

module.exports = {
    logTaskHistory
}
