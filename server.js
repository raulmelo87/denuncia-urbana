const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();

// Configuração do express-session para gerenciar sessões de usuário
app.use(session({
    secret: 'seuSegredoAqui',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));

// Conexão com o MongoDB Atlas
const mongoURI = 'mongodb+srv://fraulbmelo:Chess0010@cluster0.sximque.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Conectado ao MongoDB Atlas'))
.then(() => console.log('Acesse "localhost:3000" em seu navegador'))
.catch(err => console.log('Erro na conexão com o MongoDB:', err));

// MODELOS - USUÁRIOS E DENÚNCIA

// Modelo de Usuário
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    isAdmin: { type: Boolean, default: false }  // campo para identificar administradores
});
const User = mongoose.model('User', userSchema);

// Modelo de Denúncia (agora vinculada ao usuário que a criou)
// Campo "aprovado" determina se a denúncia foi avaliada e liberada para exibição
const denunciaSchema = new mongoose.Schema({
    descricao: String,
    imagem: String,
    resolvido: { type: Boolean, default: false },
    data: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    aprovado: { type: Boolean, default: false } // denuncia fica pendente de aprovação
});
const Denuncia = mongoose.model('Denuncia', denunciaSchema);

// CONFIGURAÇÃO DO MULTER (UPLOAD)

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// MIDDLEWARE PARA VERIFICAÇÃO DE LOGIN

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// MIDDLEWARE PARA VERIFICAÇÃO DE ADMINISTRADOR

function isAdmin(req, res, next) {
    // Se o usuário estiver logado e tiver isAdmin definido na sessão, permite acesso
    if (req.session.userId && req.session.isAdmin) {
        return next();
    } else {
        return res.status(403).send('Acesso negado: apenas administradores podem acessar essa rota');
    }
}
