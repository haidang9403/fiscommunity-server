const Yup = require("yup");

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
    errorValidate,
    errorValidateAll
}