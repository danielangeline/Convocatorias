/**
 * RF-119 · Pasos del recorrido de bienvenida de la empresa (CU-51). `objetivo`
 * es el valor de `data-recorrido` del elemento que se resalta (los ítems del
 * menú usan su href); sin objetivo, el recuadro va centrado.
 *
 * Los textos no prometen lo que la plataforma no hace (RN-19: aquí se prepara,
 * no se radica) ni fijan tarifas de créditos, que cambia el administrador (RF-100).
 */
export interface PasoRecorrido {
  objetivo?: string;
  titulo: string;
  texto: string;
}

export const PASOS_EMPRESA: PasoRecorrido[] = [
  {
    titulo: "Te damos la bienvenida",
    texto:
      "En un par de minutos te mostramos para qué sirve cada sección. Puedes omitir el recorrido cuando quieras y volver a verlo desde Ajustes.",
  },
  {
    objetivo: "/inicio",
    titulo: "Inicio",
    texto:
      "Tu resumen: los fondos disponibles para tu perfil, los próximos cierres, las sugeridas para tus proyectos y cómo van tus postulaciones.",
  },
  {
    objetivo: "buscar",
    titulo: "Buscador",
    texto: "Escribe una palabra y busca en todo el catálogo de convocatorias. Atajo: Ctrl + K.",
  },
  {
    objetivo: "/convocatorias",
    titulo: "Convocatorias",
    texto:
      "El catálogo completo de fondos públicos, privados y de cooperación. Filtra por sector, región, monto o fecha de cierre, abre la ficha con sus requisitos y documentos, y desde ahí postula o genera tu documento con IA.",
  },
  {
    objetivo: "/sugeridas",
    titulo: "Sugeridas para ti",
    texto:
      "Las convocatorias que mejor se ajustan a tus proyectos, con su porcentaje de compatibilidad y el detalle de por qué. Entre más completo tu proyecto, mejores sugerencias.",
  },
  {
    objetivo: "/convocatorias?tipo=beneficio_tributario",
    titulo: "Beneficios tributarios",
    texto:
      "Convocatorias que no entregan dinero sino beneficios en impuestos, como deducciones o descuentos. Es el mismo catálogo, ya filtrado por este tipo.",
  },
  {
    objetivo: "/guardadas",
    titulo: "Guardadas",
    texto:
      "Las convocatorias que marcaste para revisar después. Si alguna cierra en los próximos 7 días, te avisamos en la campana.",
  },
  {
    objetivo: "/proyectos",
    titulo: "Proyectos",
    texto:
      "Registra aquí tus proyectos: son la base de las sugerencias y de los documentos con IA. Llénalo a mano o cuéntale tu idea a la IA, por escrito o en voz alta, y ella lo arma.",
  },
  {
    objetivo: "/postulaciones",
    titulo: "Postulaciones",
    texto:
      "Prepara cada postulación con su checklist de requisitos y sigue su estado por etapas. La radicación se hace en el portal de la entidad convocante; aquí la organizas.",
  },
  {
    objetivo: "/documentos",
    titulo: "Documentos con IA",
    texto:
      "Los documentos base de postulación que genera la IA con los datos de tu proyecto y la convocatoria. Edítalos, pide ajustes y descárgalos en Word. Lo que falte queda marcado como [COMPLETAR].",
  },
  {
    objetivo: "/consultores",
    titulo: "Directorio de consultores",
    texto:
      "Expertos aprobados por la plataforma, con su perfil, experiencia y calificaciones. Si necesitas ayuda con una convocatoria, envíale una solicitud.",
  },
  {
    objetivo: "/encargos",
    titulo: "Mis encargos",
    texto:
      "Las solicitudes que hiciste a consultores: su estado, el contacto cuando aceptan y la calificación al terminar. El pago lo acuerdas directamente con el consultor.",
  },
  {
    objetivo: "/suscripcion",
    titulo: "Plan y créditos",
    texto: "Tu plan, cuándo vence, los créditos que te quedan y las opciones para cambiar de plan o conseguir más créditos.",
  },
  {
    objetivo: "creditos",
    titulo: "Tus créditos de IA",
    texto:
      "Cada uso de la IA (generar un documento, crear un proyecto o editar un apartado) cuesta créditos. Si la IA falla, no se descuenta nada.",
  },
  {
    objetivo: "notificaciones",
    titulo: "Notificaciones",
    texto: "Avisos de tus postulaciones, encargos y guardadas que están por cerrar.",
  },
  {
    objetivo: "/ajustes",
    titulo: "Ajustes",
    texto: "Los datos de tu cuenta, el cambio de contraseña, el tema claro u oscuro y la opción de repetir este recorrido.",
  },
  {
    titulo: "¡Listo para empezar!",
    texto:
      "Te recomendamos registrar tu primer proyecto: con él verás las convocatorias que más te sirven y podrás generar tu documento base.",
  },
];
