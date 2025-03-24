const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// prisma.$use(async (params, next) => {
//     const result = await next(params);

//     if (params.model === "User" && result) {
//         if (params.args?.includePassword) {
//             return result; // Nếu có includePassword thì trả về đầy đủ
//         }
//         return removePassword(result);
//     }

//     if (result) {
//         return deepRemovePassword(result, params.args?.includePassword);
//     }

//     return result;
// });

// // Hàm loại bỏ `password`
// function removePassword(data) {
//     if (Array.isArray(data)) {
//         return data.map(({ password, refreshToken, ...rest }) => rest);
//     }
//     const { password, refreshToken, ...rest } = data;
//     return rest;
// }

// // Hàm kiểm tra và loại bỏ `password` khi `User` được include trong bảng khác
// function deepRemovePassword(data, includePassword) {
//     if (Array.isArray(data)) {
//         return data.map(item => deepRemovePassword(item, includePassword));
//     } else if (typeof data === "object" && data !== null) {
//         const newData = { ...data };
//         for (const key in newData) {
//             if (key === "user" && !includePassword) {
//                 newData[key] = removePassword(newData[key]); // Xóa `password`
//             } else {
//                 newData[key] = deepRemovePassword(newData[key], includePassword);
//             }
//         }
//         return newData;
//     }
//     return data;
// }

module.exports = prisma;
