import {

  CONTACT_POINT_TYPES,

  emptyContactChannel,

  emptyContactPerson,

  getContactPointInputType,

  getContactPointPlaceholder,

} from "../lib/clientContactPoints";



function ClientContactPointsEditor({ value, onChange }) {

  const persons =

    Array.isArray(value) && value.length > 0 ? value : [emptyContactPerson()];



  const updatePerson = (personIndex, patch) => {

    const next = persons.map((person, i) =>

      i === personIndex ? { ...person, ...patch } : person,

    );

    onChange(next);

  };



  const updateChannel = (personIndex, channelIndex, patch) => {

    const channels = persons[personIndex]?.channels || [];

    const nextChannels = channels.map((channel, i) =>

      i === channelIndex ? { ...channel, ...patch } : channel,

    );

    updatePerson(personIndex, { channels: nextChannels });

  };



  const addChannel = (personIndex) => {

    const channels = persons[personIndex]?.channels || [];

    updatePerson(personIndex, { channels: [...channels, emptyContactChannel()] });

  };



  const removeChannel = (personIndex, channelIndex) => {

    const channels = persons[personIndex]?.channels || [];

    const next = channels.filter((_, i) => i !== channelIndex);

    updatePerson(personIndex, {

      channels: next.length > 0 ? next : [emptyContactChannel()],

    });

  };



  const addPerson = () => {

    onChange([...persons, emptyContactPerson()]);

  };



  const removePerson = (personIndex) => {

    const next = persons.filter((_, i) => i !== personIndex);

    onChange(next.length > 0 ? next : [emptyContactPerson()]);

  };



  return (

    <div className="client-contact-points-editor form-full-width">

      <div className="client-contact-points-head">

        <span>Контакты</span>

        <p className="hint">

          Добавьте контактных лиц (ФИО или должность) и их телефоны, почту, мессенджеры.

        </p>

      </div>

      {persons.map((person, personIndex) => (

        <div key={`contact-person-${personIndex}`} className="client-contact-person-form">

          <div className="client-contact-person-form-head">

            <span>Контактное лицо {personIndex + 1}</span>

            {persons.length > 1 ? (

              <button

                type="button"

                className="secondary-btn"

                onClick={() => removePerson(personIndex)}

              >

                Удалить лицо

              </button>

            ) : null}

          </div>

          <div className="client-contact-person-form-fields">

            <label className="field">

              <span>Имя / должность</span>

              <input

                type="text"

                placeholder="Например: Игорь Ермак или Секретарь"

                value={person.fullName ?? ""}

                onChange={(event) =>

                  updatePerson(personIndex, { fullName: event.target.value })

                }

              />

            </label>

            <label className="field">

              <span>Роль (необязательно)</span>

              <input

                type="text"

                placeholder="Директор, бухгалтер…"

                value={person.role ?? ""}

                onChange={(event) => updatePerson(personIndex, { role: event.target.value })}

              />

            </label>

          </div>

          {(person.channels || []).map((channel, channelIndex) => (

            <div

              key={`channel-${personIndex}-${channelIndex}`}

              className="client-contact-point-row"

            >

              <label className="field">

                <span>Тип</span>

                <select

                  value={channel.type || "phone"}

                  onChange={(event) =>

                    updateChannel(personIndex, channelIndex, { type: event.target.value })

                  }

                >

                  {CONTACT_POINT_TYPES.map((option) => (

                    <option key={option.value} value={option.value}>

                      {option.label}

                    </option>

                  ))}

                </select>

              </label>

              <label className="field">

                <span>Значение</span>

                <input

                  type={getContactPointInputType(channel.type)}

                  placeholder={getContactPointPlaceholder(channel.type)}

                  value={channel.value ?? ""}

                  onChange={(event) =>

                    updateChannel(personIndex, channelIndex, { value: event.target.value })

                  }

                />

              </label>

              <button

                type="button"

                className="secondary-btn client-contact-point-remove"

                onClick={() => removeChannel(personIndex, channelIndex)}

                title="Удалить канал"

              >

                Удалить

              </button>

            </div>

          ))}

          <button

            type="button"

            className="secondary-btn"

            onClick={() => addChannel(personIndex)}

          >

            Добавить телефон / почту / соцсеть

          </button>

        </div>

      ))}

      <button type="button" className="secondary-btn" onClick={addPerson}>

        Добавить контактное лицо

      </button>

    </div>

  );

}



export default ClientContactPointsEditor;

