const promisify = require('es6-promisify');
const mongoose = require('mongoose');
const Questao = mongoose.model('Questao');
const Submissao = mongoose.model('Submissao');
const SubmissaoProva = mongoose.model('SubmissaoProva');
const Rascunho = mongoose.model('Rascunho');
const Sessions = mongoose.model('Sessions');
const User = mongoose.model('User');
const Data = mongoose.model('Data');
const crypto = require('crypto');
const executar = require('../negocio/executar');
const passport = require('passport');
const mailController = require('./mailController');

/**
 * Incrementa o contador de execuções no banco de forma atômica
 */
exports.incrementarExecucoes = (req, res, next) => {
  Data.findOneAndUpdate(
    {},
    {
      $inc: { exec: 1 }
    },
    {
      upsert: true
    },
    function(err, data) {
      if (err) {
        console.log('Erro ao salvar execução no banco');
        throw err;
      }
    }
  );
  next();
};

exports.incrementarCliqueNovidades = (req, res) => {
  Data.findOneAndUpdate(
    {},
    {
      $inc: { cliqueNovidades: 1 }
    },
    {
      upsert: true
    },
    function(err, data) {
      if (err) {
        console.error('Erro ao incrementar clique em novidades');
        throw err;
      }
    }
  );
};

/**
 * Execução de código em que os resultados esperados vem na requisição
 * Utilizado na execução presente no cadastro de questões
 */
exports.executarCodigoComResultado = (req, res) => {
  console.log(req.body);
  const { codigo, resultadosEsperados } = req.body;
  if (!resultadosEsperados || !resultadosEsperados[0] || !resultadosEsperados[0].saida) {
    res.status(500).send('Resultados esperados vieram nulos');
    return;
  }

  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entrada: resultadosEsperados[i].entradas.join(' '),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

/**
 * Execução de código em que os resultados são extraídos de uma questão específica
 * Utilizado no editor de código da página de questões do sistema
 */
exports.executarCodigoQuestao = async (req, res) => {
  console.log(req.body.codigo);
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send('Nenhuma questão encontrada para o id informado');
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entrada: `[${resultadosEsperados[i].entradas.join(', ')}]`,
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

/**
 * Execução de código de questão de uma prova. Semelhante a execução de uma questão normal
 * entretanto só retorna um caso de teste para o usuário
 */
exports.executarCodigoQuestaoProva = async (req, res) => {
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send('Nenhuma questão encontrada para o id informado');
    return;
  }
  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < 1; i++) {
    resultados.push({
      entrada: `[${resultadosEsperados[i].entradas.join(', ')}]`,
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  res.json(resultados);
};

exports.submeterCodigoQuestao = async (req, res) => {
  if (!req.user) {
    res.status(500).send('Você precisa estar logado para submeter questões');
    return;
  }
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  if (!questao) {
    res.status(500).send('Nenhum questão encontrada para o id informado.');
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entradas: resultadosEsperados[i].entradas.join(' '),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  let acertos = 0;
  resultados.forEach(res => {
    if (res.saida === res.saidaEsperada) {
      acertos++;
    }
  });

  const porcentagemAcerto = Math.trunc(acertos * 100 / resultados.length);

  const submissao = new Submissao({
    codigo,
    questao: questao._id,
    resultados,
    porcentagemAcerto,
    user: req.user
  });

  await submissao.save();
  res.json(submissao);
};

exports.submeterCodigoQuestaoProva = async (req, res) => {
  if (!req.user) {
    res.status(500).send('Você precisa estar logado para submeter questões');
    return;
  }
  const { codigo, questaoId, provaId } = req.body;
  const questao = await Questao.findOne({ _id: questaoId });
  if (!questao) {
    res.status(500).send('Nenhum questão encontrada para o id informado.');
    return;
  }

  const resultadosEsperados = questao.resultados;
  const resultados = [];
  for (let i = 0; i < resultadosEsperados.length; i++) {
    resultados.push({
      entradas: resultadosEsperados[i].entradas.join(' '),
      saida: executar(codigo, resultadosEsperados[i].entradas),
      saidaEsperada: resultadosEsperados[i].saida
    });
  }

  let acertos = 0;
  resultados.forEach(res => {
    if (res.saida === res.saidaEsperada) {
      acertos++;
    }
  });

  const porcentagemAcerto = Math.trunc(acertos * 100 / resultados.length);

  const submissaoProva = new SubmissaoProva({
    codigo,
    questao: questao._id,
    resultados,
    porcentagemAcerto,
    user: req.user,
    prova: provaId
  });

  console.log(
    `Aluno "${req.user.nome}" de matrícula "${req.user
      .matricula}" submeteu a questão "${questao.titulo}" e obteve ${porcentagemAcerto}% de acerto.`
  );

  await submissaoProva.save();
  res.json('Questão submetida com sucesso');
};

exports.getTags = async (req, res) => {
  const tags = await Questao.find().distinct('tags');
  res.json(tags);
};

exports.getQuestoes = async (req, res) => {
  const questoes = await Questao.find();
  res.json(questoes);
};

exports.salvarRascunho = async (req, res) => {
  const { codigo, id } = req.body;
  const questao = await Questao.findOne({ _id: id });
  const data = Date.now();

  const rascunho = {
    questao,
    codigo,
    user: req.user,
    data
  };

  const rascunhoSalvo = await Rascunho.findOneAndUpdate({ questao, user: req.user }, rascunho, {
    new: true,
    upsert: true
  }).exec();
  res.json(rascunhoSalvo);
};

exports.loginUser = function(req, res, next) {
  passport.authenticate('local', function(err, user) {
    if (err) {
      res.status(500).json({ erro: err });
      return next(err);
    }

    if (!user) {
      return res.status(203).json({
        codigo: 203,
        msg: 'Usuário ou senha inválidos.',
        status: false
      });
    }

    req.logIn(user, function(err) {
      if (err) {
        res.status(500).json({ erro: err });
        next(err);
      }

      return res.status(200).json({
        codigo: 200,
        msg: 'Usuário logado com sucesso.',
        status: true,
        nome: user.nome,
        email: user.email,
        matricula: user.matricula,
        sigaa: user.sigaa,
        questoesFavoritas: user.questoesFavoritas,
        listasFavoritas: user.listasFavoritas,
        idSessao: req.session.id
      });
    });
  })(req, res, next);
};

exports.esqueceuSenha = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  console.log(user);
  if (!user) {
    return res.status(203).json({ status: false, msg: 'E-mail de alteração de senha enviado.' });
  }

  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1h para resetar a senha
  await user.save();

  const resetUrl = 'http://${req.headers.host}/conta/resetar-senha/${user.resetPasswordToken}';
  try {
    await mailController.sendResetPwdMail(user.email, resetUrl);
    return res
      .status(200)
      .json({ status: true, msg: 'Um email de alteração de senha foi enviado para ' + req.body.email });
  } catch (err) {
    console.error(err);
    return res.status(203).json({
      status: false,
      msg: 'Ocorreu algum erro ao enviar seu email de alteração de senha, contate o administrador do sistema'
    });
  }
};

exports.registrarAPI = async (req, res) => {
  const user = new User({ email: req.body.email, nome: req.body.nome, matricula: req.body.matricula });
  const registerWithPromise = promisify(User.register, User);
  await registerWithPromise(user, req.body.password);
  return res.status(200).json({
    status: true,
    msg: 'Usuário cadastrado com sucesso',
    email: req.body.email,
    nome: req.body.nome,
    matricula: req.body.matricula
  });
};

exports.sessionStatus = function(req, res) {
  Sessions.find({ _id: req.body.id }, function(err, date) {
    if (err) {
      return res.status(500).json({ status: false, msg: 'Erro interno.' });
    }
    if (date.length > 0) {
      var now = new Date().getTime();
      if (now < date[0].expires.getTime()) return res.status(200).json({ status: true, msg: 'Sessão ativa' });
      return res.status(203).json({ status: false, msg: 'Sessão expirada' });
    }
    return res.status(203).json({ status: false, msg: 'Sessão não encontrada' });
  });
};

exports.lopStatus = function(req, res) {
  return res.status(200).json({ status: true, msg: 'Bem vindo a plataforma LoP', msgEnviada: req.body.msg });
};

exports.finalizarSession = function(req, res) {
  Sessions.findByIdAndRemove(req.body.id, function(err, data) {
    if (err) return res.status(500).json({ status: false, msg: 'Erro interno.' });
    if (data != null) {
      return res.status(200).json({ status: true, msg: 'Sessão finalizada' });
    }
    return res.status(404).json({ status: false, msg: 'Sessão não encontrada' });
  });
};
