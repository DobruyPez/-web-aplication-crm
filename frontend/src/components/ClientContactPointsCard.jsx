import {

  CONTACT_POINT_TYPE_LABELS,

  formatContactPointLink,

  resolveContactPersonsForDisplay,

} from "../lib/clientContactPoints";



export function ClientContactPointsCard({ client, contactPoints }) {

  const persons = resolveContactPersonsForDisplay(

    client ?? (contactPoints !== undefined ? { contactPoints } : {}),

  );

  if (persons.length === 0) {

    return null;

  }



  return (

    <section className="client-contact-points-card" aria-label="Контакты">

      <h4 className="client-contact-points-card-title">Контакты</h4>

      <div className="client-contacts-persons">

        {persons.map((person, personIndex) => (

          <div

            key={person.id ?? `person-${personIndex}`}

            className="client-contact-person-block"

          >

            <div className="client-contact-person-heading">

              <strong className="client-contact-person-name">{person.fullName}</strong>

              {person.role ? (

                <span className="client-contact-person-role">{person.role}</span>

              ) : null}

            </div>

            <ul className="client-contact-points-list">

              {(person.channels || []).map((channel, channelIndex) => {

                const typeLabel = CONTACT_POINT_TYPE_LABELS[channel.type] || channel.type;

                const link = formatContactPointLink(channel.type, channel.value);



                return (

                  <li

                    key={channel.id ?? `${channel.type}-${channelIndex}`}

                    className="client-contact-point-item"

                  >

                    <div className="client-contact-point-item-meta">

                      <span className="client-contact-point-badge">{typeLabel}</span>

                    </div>

                    <div className="client-contact-point-item-value">

                      {link.href ? (

                        <a

                          href={link.href}

                          {...(link.external

                            ? { target: "_blank", rel: "noreferrer noopener" }

                            : {})}

                          title={String(channel.value || "")}

                        >

                          {link.label}

                        </a>

                      ) : (

                        link.label

                      )}

                    </div>

                  </li>

                );

              })}

            </ul>

          </div>

        ))}

      </div>

    </section>

  );

}



export default ClientContactPointsCard;

