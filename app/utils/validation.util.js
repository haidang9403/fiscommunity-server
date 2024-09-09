const Yup = require("yup");
const prisma = require("../services/prisma");
const bcrypt = require('bcrypt');

const authSchema = {
    login: Yup.object().shape({
        password: Yup.string().required("Hãy nhập mật khẩu").min(6, "Mật khẩu có ít nhất 6 ký tự"),
        email: Yup.string().required("Hãy nhập email").email("Email không hợp lệ"),
    }),
    register: Yup.object().shape({
        confirmPassword: Yup.string().required("Hãy xác nhận lại mật khẩu").oneOf([Yup.ref('password'), null], "Xác nhận không chính xác"),
        password: Yup.string().required("Mật khẩu không được bỏ trống").min(6, "Mật khẩu có tối thiểu 6 ký tự"),
        email: Yup.string().required("Email không được bỏ trống").email("Email không hợp lệ"),
        fullname: Yup.string().required("Họ và tên không được bỏ trống"),
        birthday: Yup.date().required("Ngày sinh không được bỏ trống"),
        gender: Yup.number().required("Giới tính không được bỏ trống")
    })
}

const userSchema = {
    changePassword: Yup.object().shape({
        oldPassword: Yup.string().required("Hãy nhập mật khẩu cũ").test('matchOldPassword', 'Mật khẩu cũ không chính xác', async function (value) {
            const { userId } = this.options.context; // Lấy userId từ context
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { password: true } // Lấy mật khẩu đã băm
            });

            if (!user) {
                return this.createError({ message: "Người dùng không tồn tại" });
            }

            const isMatch = await bcrypt.compare(value, user.password);
            return isMatch;
        }),
        newPassword: Yup.string().required("Hãy nhập mật khẩu mới").min(6, "Mật khẩu có tối thiểu 6 ký tự"),
        confirmPassword: Yup.string().required("Hãy xác nhận lại mật khẩu").oneOf([Yup.ref('newPassword'), null], "Xác nhận không chính xác")
    })
}

const errorValidate = (res, error) => {
    if (error.name === "ValidationError") {
        error.statusCode = 422
        const err = {
            [error.path]: error.message
        }
        return res.status(422).send(err)
    };
}

const errorValidateAll = (res, error) => {
    if (error.name && error.name === "ValidationError") {
        error.statusCode = 422
        const errors = error.inner.reduce((totalErrors, err) => {
            return {
                ...totalErrors,
                [err.path]: err.message
            }
        }, {});
        return res.status(422).send(errors)
    }
}

module.exports = {
    authSchema,
    userSchema,
    errorValidate,
    errorValidateAll
}