import React from 'react';
import { connect } from 'react-redux';

class ReactClassComponent extends React.Component {
  render() {
    return <div>Class Component</div>;
  }
}

const mapStateToProps = state => ({
  data: state.data,
});

export default connect(mapStateToProps)(ReactClassComponent);
