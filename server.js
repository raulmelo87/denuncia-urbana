const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

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
const mongoURI = 'mongodb+srv://raulkmkz87:Chess0010@cluster0.0x7fy7r.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Conectado ao MongoDB Atlas'))
.catch(err => console.log('Erro na conexão com o MongoDB:', err));

/* ===============================
   MODELOS - Usuário e Denúncia
   =============================== */

// Modelo de Usuário
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String
});
const User = mongoose.model('User', userSchema);

// Modelo de Denúncia (agora vinculada ao usuário que a criou)
const denunciaSchema = new mongoose.Schema({
    descricao: String,
    imagem: String,
    resolvido: { type: Boolean, default: false },
    data: { type: Date, default: Date.now },
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});
const Denuncia = mongoose.model('Denuncia', denunciaSchema);

/* ===============================
   Configuração do Multer (upload)
   =============================== */
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/* ===============================
   Middleware para Verificação de Login
   =============================== */
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

/* ===============================
   ROTAS - Autenticação
   =============================== */

// Página de registro (GET)
app.get('/register', (req, res) => {
    res.render('register');
});

// Registro de usuário (POST)
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Criptografa a senha antes de salvar
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.redirect('/login');
    } catch (err) {
        res.status(500).send('Erro no registro: ' + err);
    }
});

// Página de login (GET)
app.get('/login', (req, res) => {
    res.render('login');
});

// Login (POST)
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) {
            return res.redirect('/login?error=' + encodeURIComponent('Usuário não encontrado'));
        }
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user._id;
            res.redirect('/');
        } else {
            return res.redirect('/login?error=' + encodeURIComponent('Senha incorreta'));
        }
    } catch (err) {
        res.status(500).send('Erro no login: ' + err);
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

/* ===============================
   ROTAS - Denúncias
   =============================== */

// Página principal: exibe as denúncias (sempre para todos, mas o formulário aparece apenas para usuários logados)
app.get('/', async (req, res) => {
    try {
        // Popula o campo 'usuario' para cada denúncia
        const denuncias = await Denuncia.find().sort({ data: -1 }).populate('usuario');
        res.render('index', { denuncias, userId: req.session.userId });
    } catch (err) {
        res.status(500).send('Erro ao buscar denúncias');
    }
});

// Rota para submeter uma nova denúncia (somente usuários logados podem enviar)
app.post('/denunciar', isAuthenticated, upload.single('imagem'), async (req, res) => {
    try {
        // Verifica se ambos os campos foram enviados e se o arquivo possui conteúdo
        if (!req.body.descricao || !req.file || req.file.size === 0) {
            return res.status(400).send('Erro: Denúncia deve conter texto e imagem');
        }

        const novaDenuncia = new Denuncia({
            descricao: req.body.descricao,
            imagem: req.file.filename,
            usuario: req.session.userId
        });
        await novaDenuncia.save();
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Erro ao salvar a denúncia');
    }
});

// Rota para atualizar o status da denúncia (somente o autor da denúncia pode alterar)
app.post('/denuncia/:id/status', isAuthenticated, async (req, res) => {
    try {
        const denuncia = await Denuncia.findById(req.params.id);
        if (!denuncia) {
            return res.status(404).send('Denúncia não encontrada');
        }
        // Verifica se o usuário logado é o criador da denúncia
        if (denuncia.usuario.toString() !== req.session.userId.toString()) {
            return res.status(403).send('Você não tem permissão para alterar esta denúncia');
        }
        const { status } = req.body; // "true" ou "false" (em formato string)
        denuncia.resolvido = status === 'true';
        await denuncia.save();
        res.redirect('/');
    } catch (err) {
        res.status(500).send('Erro ao atualizar status');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
