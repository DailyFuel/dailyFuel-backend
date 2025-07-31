import mongoose, { Mongoose, Schema, Types, model } from "mongoose";
import bcrypt from 'bcrypt'

const SALT_WORK_FACTOR = 10;

const userSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: [true, 'Please enter a valid email address'],
        minLength: 3,
        maxLength: 100,
        match: [/.+@.+\..+/, 'Please enter a valid email address.']
    },
    password: {
        type: String,
        minlength: [8, 'Password must be at least 8 characters'],
        required: [true, 'Please enter a valid password'],
        validate: {
            validator: function (v) {
                return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(v) 
            },
            message: props => 'Password must include upper/lowercase letter and a number'
        }
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    createdAt: {
        type: String,
        default: Date.now()
    },
    role: {
        default: "user"
    },
    subscripitonStatus: {
        type: String,
        enum: ['free', 'premium']
    },
    // affiliateCode : {
    //     type: Schema.Types.ObjectId,
    //     ref: 'Affiliate.code'
    // }

});

// userSchema.pre('save', async function save(next) {
//     const user = this;

//     // Only hash the password if it has been modified (or is new)
//     if (!this.isModified('password')) return next();

//     try {
//         // Generate a salt
//         const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);

//         // Hash the password using new salt
//         this.password = await bcrypt.hash(this.password, salt);
//         return next()
//     } catch (err) {
//         return next(err)
//     }
// });

// userSchema.methods.validatePassword = async function validatePassword(data) {
//     return bcrypt.compare(data, this.password)
// };

const User = model('User', userSchema);

export default User;